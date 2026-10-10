#Requires -Version 7.4
#Requires -Modules @{ ModuleName = 'powershell-yaml'; ModuleVersion = '0.4.0' }
<#
.SYNOPSIS
    Reference suggester for the Subject Vocabulary Standard 0.9.

.DESCRIPTION
    Proposes subjects for Markdown documents as suggest.md specifies, with the
    reasons for each suggestion, and writes the suggestions document to the
    output stream. It opens documents read-only and has no parameter that
    writes anything; a person accepts suggestions.

    SPDX-License-Identifier: Apache-2.0. Copyright 2026 Jamie Clayton.

.PARAMETER Path
    Markdown files, or folders searched recursively for *.md.

.PARAMETER RepositoryRoot
    The root that output paths are relative to, and where the adoption
    register is found by default. Defaults to the current location.

.PARAMETER Scheme
    The core scheme: a path, or the parsed object. Defaults to the scheme.json
    of this version folder, the copy an adopter vendors.

.PARAMETER Register
    The adoption register: a path, the parsed object, or $null. Defaults to
    docs/registers/subject-vocabulary.json under RepositoryRoot when present.

.PARAMETER WithLinks
    Use front-matter references, requires and isPartOf between the given
    documents (the link-neighbour signal).

.PARAMETER DefinitionWeight
    Cap of the definition signal; 0 disables it. Exposed for measurement.

.PARAMETER HideExistingSubjects
    Ignore each document's own subject entries, as when measuring recall.

.PARAMETER AsJson
    Emit JSON text instead of an object.

.EXAMPLE
    ./Suggest-Subjects.ps1 -Path docs -RepositoryRoot . -AsJson
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string[]] $Path,

    [string] $RepositoryRoot = (Get-Location).Path,

    [object] $Scheme = (Join-Path $PSScriptRoot '..' 'scheme.json'),

    [AllowNull()]
    [object] $Register,

    [switch] $WithLinks,

    [ValidateRange(0, 10)]
    [double] $DefinitionWeight = 1.5,

    [switch] $HideExistingSubjects,

    [switch] $AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Signals = 'existing-subject', 'title', 'description', 'heading', 'body', 'definition', 'link-neighbour', 'component-path'
$FieldWeights = @{ title = 3; description = 2; heading = 1.5 }
$Threshold = 0.35
$MaxSuggestions = 3
$Ordinal = [StringComparer]::Ordinal

function Read-Document([object] $Value) {
    if ($null -eq $Value) { return $null }
    if ($Value -is [string]) { return Get-Content -LiteralPath $Value -Raw | ConvertFrom-Json -Depth 32 }
    return $Value
}

function Get-Value([object] $Object, [string] $Name) {
    if ($null -eq $Object) { return $null }
    if ($Object -is [System.Collections.IDictionary]) { return $Object[$Name] }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Get-Round([double] $Value) { [Math]::Round($Value, 4, [MidpointRounding]::AwayFromZero) }

function Get-Sorted([string[]] $Values) {
    $copy = [string[]]@($Values)
    [Array]::Sort($copy, $Ordinal)
    return , $copy
}

# suggest.md section 1: normalise as resolve.md step 3, then split into words.
# Words are maximal runs of letters, digits, hyphens and underscores, with
# leading and trailing hyphens removed: everything else becomes a separator.
function Get-Words([string] $Text) {
    if ([string]::IsNullOrEmpty($Text)) { return , [string[]]@() }
    $normal = $Text.Normalize([Text.NormalizationForm]::FormC).ToLowerInvariant()
    $spaced = ($normal -replace '[^\p{L}\p{N}_-]+', ' ') -replace '(?<![\p{L}\p{N}_-])-+|-+(?![\p{L}\p{N}_-])', ' '
    return , $spaced.Split(' ', [StringSplitOptions]::RemoveEmptyEntries)
}

# Counts, in one pass over the words, every phrase of one to three words that
# is a label phrase (suggest.md section 1). The loop runs in a few lines of C#
# compiled in process by Add-Type, which PowerShell 7 includes, because a
# PowerShell loop over every word of a large corpus misses the time budget.
if (-not ('SubjectVocabulary.PhraseCounter' -as [type])) {
    Add-Type -TypeDefinition @'
using System.Collections.Generic;
namespace SubjectVocabulary {
    public static class PhraseCounter {
        public static Dictionary<string, int> Count(string[] words, HashSet<string> phrases) {
            var counts = new Dictionary<string, int>(System.StringComparer.Ordinal);
            for (int i = 0; i < words.Length; i++) {
                string phrase = words[i];
                for (int length = 1; length <= 3 && i + length <= words.Length; length++) {
                    if (length > 1) phrase = phrase + " " + words[i + length - 1];
                    if (phrases.Contains(phrase)) counts[phrase] = counts.TryGetValue(phrase, out int n) ? n + 1 : 1;
                }
            }
            return counts;
        }
    }
}
'@
}

function Get-PhraseCounts([string] $Text) {
    return , [SubjectVocabulary.PhraseCounter]::Count((Get-Words $Text), $script:AllPhrases)
}

function ConvertTo-PathRegex([string] $Pattern) {
    $builder = [Text.StringBuilder]::new('^')
    for ($i = 0; $i -lt $Pattern.Length; $i++) {
        $char = $Pattern[$i]
        if ($char -eq '*' -and $i + 1 -lt $Pattern.Length -and $Pattern[$i + 1] -eq '*') { [void]$builder.Append('.*'); $i++ }
        elseif ($char -eq '*') { [void]$builder.Append('[^/]*') }
        elseif ($char -eq '?') { [void]$builder.Append('[^/]') }
        else { [void]$builder.Append([regex]::Escape([string]$char)) }
    }
    return [regex]::new($builder.Append('$').ToString(), [Text.RegularExpressions.RegexOptions]::CultureInvariant)
}

function ConvertTo-List([object] $Value) {
    if ($null -eq $Value) { return , [string[]]@() }
    return , [string[]]@(@($Value) | Where-Object { $_ -is [string] -and $_.Length -gt 0 })
}

# Front matter through the YamlDotNet parser powershell-yaml ships: only
# top-level scalars and sequences of scalars are read, which is all the
# suggester needs (title, description, subject, id and the link keys).
function Read-FrontMatter([string] $Yaml, [string] $File) {
    $result = @{}
    try {
        $stream = [YamlDotNet.RepresentationModel.YamlStream]::new()
        $stream.Load([IO.StringReader]::new($Yaml))
    }
    catch {
        Write-Warning "Front matter of $File is not valid YAML; reading it as a document without front matter."
        return $null
    }
    if ($stream.Documents.Count -eq 0) { return $null }
    $rootNode = $stream.Documents[0].RootNode
    if ($rootNode -isnot [YamlDotNet.RepresentationModel.YamlMappingNode]) { return $null }
    foreach ($entry in $rootNode.Children) {
        if ($entry.Key -isnot [YamlDotNet.RepresentationModel.YamlScalarNode]) { continue }
        $value = $entry.Value
        if ($value -is [YamlDotNet.RepresentationModel.YamlScalarNode]) { $result[$entry.Key.Value] = $value.Value }
        elseif ($value -is [YamlDotNet.RepresentationModel.YamlSequenceNode]) {
            $result[$entry.Key.Value] = [string[]]@(foreach ($item in $value.Children) { if ($item -is [YamlDotNet.RepresentationModel.YamlScalarNode]) { $item.Value } })
        }
    }
    return $result
}

function Read-Markdown([string] $File) {
    $text = [IO.File]::ReadAllText($File)
    $lines = $text -split "\r?\n"
    $frontMatter = $null
    $start = 0
    if ($lines.Count -gt 0 -and $lines[0] -eq '---') {
        for ($i = 1; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -eq '---' -or $lines[$i] -eq '...') {
                $yaml = ($lines[1..($i - 1)] -join "`n")
                if ($i -gt 1 -and $yaml.Trim().Length -gt 0) { $frontMatter = Read-FrontMatter $yaml $File }
                $start = $i + 1
                break
            }
        }
    }
    $content = if ($start -lt $lines.Count) { $lines[$start..($lines.Count - 1)] -join "`n" } else { '' }
    # Fenced code blocks leave the text fields (an unclosed fence runs to the end).
    $text = [regex]::Replace($content, '(?ms)^[ \t]*(```|~~~)[^\n]*\n.*?^[ \t]*\1[^\n]*$', '')
    $text = [regex]::Replace($text, '(?ms)^[ \t]*(```|~~~).*\z', '')
    $title = [Collections.Generic.List[string]]::new()
    $headings = [Collections.Generic.List[string]]::new()
    foreach ($heading in [regex]::Matches($text, '(?m)^(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$')) {
        if ($heading.Groups[1].Value.Length -eq 1 -and $title.Count -eq 0) { $title.Add($heading.Groups[2].Value) }
        else { $headings.Add($heading.Groups[2].Value) }
    }
    $body = [regex]::Replace($text, '(?m)^#{1,6}[ \t]+.*$', '')
    $fmTitle = Get-Value $frontMatter 'title'
    if ($fmTitle -is [string]) { $title.Insert(0, $fmTitle) }
    $description = Get-Value $frontMatter 'description'
    return [pscustomobject]@{
        FrontMatter = $frontMatter
        Subject     = ConvertTo-List (Get-Value $frontMatter 'subject')
        Title       = $title -join "`n"
        Description = if ($description -is [string]) { $description } else { '' }
        Headings    = $headings -join "`n"
        Body        = $body
        Raw         = $content
    }
}

# ---- Vocabulary ----
$schemeDocument = Read-Document $Scheme
if (-not $PSBoundParameters.ContainsKey('Register')) {
    $default = Join-Path $RepositoryRoot 'docs' 'registers' 'subject-vocabulary.json'
    $Register = if (Test-Path -LiteralPath $default -PathType Leaf) { $default } else { $null }
}
$registerDocument = Read-Document $Register
$replace = (Get-Value $registerDocument 'core') -eq 'replace'

$sources = @{}
if (-not $replace) { foreach ($concept in @(Get-Value $schemeDocument 'concepts')) { $sources[$concept.notation] = $concept } }
foreach ($concept in @(Get-Value $registerDocument 'concepts') + @(Get-Value $registerDocument 'components')) {
    if ($null -ne $concept) { $sources[$concept.notation] = $concept }
}

# ---- Documents ----
$root = [IO.Path]::GetFullPath($RepositoryRoot, (Get-Location).ProviderPath)
$rootPrefix = $root.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$files = foreach ($item in $Path) {
    # Relative paths resolve against the current location, as for any command.
    $full = [IO.Path]::GetFullPath($item, (Get-Location).ProviderPath)
    if (Test-Path -LiteralPath $full -PathType Container) { Get-ChildItem -LiteralPath $full -Recurse -File -Filter '*.md' | ForEach-Object FullName }
    elseif (Test-Path -LiteralPath $full -PathType Leaf) { $full }
    else { throw "Not found: $item" }
}
foreach ($file in $files) {
    if (-not $file.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Outside the repository root $root`: $file" }
}
$documents = [ordered]@{}
foreach ($file in (Get-Sorted @($files | ForEach-Object { [IO.Path]::GetRelativePath($root, $_).Replace('\', '/') } | Select-Object -Unique))) {
    $documents[$file] = Read-Markdown (Join-Path $root $file)
}

# One resolver call for every subject entry in the run (resolve.md).
$resolver = Join-Path $PSScriptRoot '..' 'resolve' 'Resolve-Subject.ps1'
$tokens = [string[]]@($documents.Values | ForEach-Object { $_.Subject } | Select-Object -Unique)
$resolved = & $resolver -Scheme $schemeDocument -Register $registerDocument -Token $tokens
$byToken = @{}
foreach ($resolution in @($resolved.resolutions)) { if ($null -ne $resolution) { $byToken[$resolution['token']] = $resolution } }
$vocabulary = [ordered]@{}
foreach ($entry in @($resolved.vocabulary)) { if ($null -ne $entry) { $vocabulary[$entry['notation']] = $entry } }
$notations = Get-Sorted @($vocabulary.Keys)

# Label phrases and definition terms, built once (suggest.md sections 2 and 3).
$stopWords = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach ($line in [IO.File]::ReadAllLines((Join-Path $PSScriptRoot 'stopwords.txt'))) {
    $word = $line.Trim()
    if ($word.Length -gt 0 -and -not $word.StartsWith('#')) { [void]$stopWords.Add($word) }
}
$phrases = @{}
$terms = @{}
$script:AllPhrases = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach ($notation in $notations) {
    $concept = $sources[$notation]
    $labels = @(Get-Value $concept 'prefLabel') + @(Get-Value $concept 'altLabel') + @($vocabulary[$notation]['hiddenLabel'])
    $set = [Collections.Generic.SortedSet[string]]::new([StringComparer]::Ordinal)
    foreach ($label in $labels) {
        if ($label -isnot [string]) { continue }
        $words = Get-Words $label
        if ($words.Count -ge 1 -and $words.Count -le 3) { [void]$set.Add($words -join ' ') }
    }
    $phrases[$notation] = [string[]]@($set)
    foreach ($phrase in $set) { [void]$script:AllPhrases.Add($phrase) }
    $definitionTerms = [Collections.Generic.SortedSet[string]]::new([StringComparer]::Ordinal)
    foreach ($word in (Get-Words ([string](Get-Value $concept 'definition')))) {
        if ($word.Length -ge 3 -and -not $stopWords.Contains($word)) { [void]$definitionTerms.Add($word) }
    }
    $terms[$notation] = [string[]]@($definitionTerms)
}

$componentRules = foreach ($component in @(Get-Value $registerDocument 'components')) {
    if ($null -eq $component -or -not $vocabulary.Contains($component.notation)) { continue }
    $broader = @(Get-Value $component 'broader') | Where-Object { $_ }
    $target = if (@($broader).Count -gt 0) { @($broader)[0] } else { $component.notation }
    foreach ($pattern in @($component.paths)) { [pscustomobject]@{ Regex = ConvertTo-PathRegex $pattern; Target = $target } }
}

function Get-ResolvedNotations([string[]] $Subject) {
    $result = foreach ($token in $Subject) {
        $resolution = $byToken[$token]
        if ($null -ne $resolution -and $resolution.Contains('notation') -and $vocabulary.Contains($resolution['notation'])) { $resolution['notation'] }
    }
    return , [string[]]@($result | Select-Object -Unique)
}

# Link neighbours: by front-matter id, or a relative path that reaches the document.
$byId = @{}
foreach ($key in $documents.Keys) {
    $id = Get-Value $documents[$key].FrontMatter 'id'
    if ($id -is [string] -and -not $byId.ContainsKey($id)) { $byId[$id] = $key }
}
function Get-Neighbours([string] $Key) {
    $document = $documents[$Key]
    $values = [Collections.Generic.List[string]]::new()
    foreach ($field in 'references', 'requires', 'isPartOf') { $values.AddRange((ConvertTo-List (Get-Value $document.FrontMatter $field))) }
    $found = foreach ($value in $values) {
        if ($byId.ContainsKey($value)) { $byId[$value]; continue }
        if ($value -match '^[A-Za-z][A-Za-z0-9+.-]*:') { continue }
        $target = [IO.Path]::GetRelativePath($root, [IO.Path]::GetFullPath((Join-Path $root ([IO.Path]::GetDirectoryName($Key)) $value.Split('#')[0]))).Replace('\', '/')
        if ($documents.Contains($target)) { $target }
    }
    return , (Get-Sorted @($found | Where-Object { $_ -ne $Key } | Select-Object -Unique))
}

function Add-Signal([string] $Notation, [System.Collections.Specialized.OrderedDictionary] $Reason) {
    if (-not $script:reasons.ContainsKey($Notation)) { $script:reasons[$Notation] = [Collections.Generic.List[object]]::new() }
    $script:reasons[$Notation].Add($Reason)
}

function New-Reason([string] $Signal, [string] $Field, [string] $Match, [double] $Weight) {
    [ordered]@{ signal = $Signal; field = $Field; match = $Match; weight = Get-Round $Weight }
}

# ---- Suggest ----
$output = foreach ($key in $documents.Keys) {
    $document = $documents[$key]
    $fields = @{
        title       = Get-PhraseCounts $document.Title
        description = Get-PhraseCounts $document.Description
        heading     = Get-PhraseCounts $document.Headings
        body        = Get-PhraseCounts $document.Body
    }
    $words = [Collections.Generic.HashSet[string]]::new([string[]](Get-Words ($document.Title, $document.Description, $document.Headings, $document.Body -join "`n")), [StringComparer]::Ordinal)

    $subject = if ($HideExistingSubjects) { [string[]]@() } else { $document.Subject }
    $carried = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $script:reasons = @{}

    # existing-subject
    foreach ($token in (Get-Sorted $subject)) {
        $resolution = $byToken[$token]
        if ($null -eq $resolution -or -not $resolution.Contains('notation')) { continue }
        $notation = $resolution['notation']
        if (-not $vocabulary.Contains($notation)) { continue }
        if ($resolution['status'] -eq 'active') { [void]$carried.Add($notation); continue }
        if (-not ($reasons.ContainsKey($notation) -and @($reasons[$notation] | Where-Object { $_['signal'] -eq 'existing-subject' }).Count)) {
            Add-Signal $notation (New-Reason 'existing-subject' 'subject' $token 4)
        }
    }

    foreach ($notation in $notations) {
        $labelPhrases = $phrases[$notation]
        foreach ($field in 'title', 'description', 'heading') {
            foreach ($phrase in $labelPhrases) {
                if ($fields[$field].ContainsKey($phrase)) { Add-Signal $notation (New-Reason $field $field $phrase $FieldWeights[$field]); break }
            }
        }
        $count = 0
        $first = $null
        foreach ($phrase in $labelPhrases) {
            if ($fields.body.ContainsKey($phrase)) { $count += $fields.body[$phrase]; if (-not $first) { $first = $phrase } }
        }
        if ($count -gt 0) { Add-Signal $notation (New-Reason 'body' 'body' $first ([Math]::Min(3.0, 1 + [Math]::Log($count)))) }
        if ($DefinitionWeight -gt 0) {
            $matched = [string[]]@(foreach ($term in $terms[$notation]) { if ($words.Contains($term)) { $term } })
            if ($matched.Count -ge 2) {
                Add-Signal $notation (New-Reason 'definition' 'definition' ($matched -join ', ') ([Math]::Min($DefinitionWeight, 0.5 * ($matched.Count - 1))))
            }
        }
    }

    if ($WithLinks) {
        $neighbours = Get-Neighbours $key
        $carriers = @{}
        foreach ($neighbour in $neighbours) {
            foreach ($notation in (Get-ResolvedNotations $documents[$neighbour].Subject)) {
                if (-not $carriers.ContainsKey($notation)) { $carriers[$notation] = [Collections.Generic.List[string]]::new() }
                $carriers[$notation].Add($neighbour)
            }
        }
        foreach ($notation in (Get-Sorted @($carriers.Keys))) {
            Add-Signal $notation (New-Reason 'link-neighbour' 'references' $carriers[$notation][0] ([Math]::Min(1.5, 0.5 * $carriers[$notation].Count)))
        }
    }

    $pathSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    if ($componentRules) {
        foreach ($match in [regex]::Matches($document.Raw, '[\p{L}\p{N}._-]*/[\p{L}\p{N}._/-]*')) {
            $candidate = $match.Value.TrimEnd('.', ',').TrimStart('.', '/')
            if ($candidate.Contains('/')) { [void]$pathSet.Add($candidate) }
        }
    }
    $paths = Get-Sorted @($pathSet)
    $componentHits = @{}
    foreach ($rule in $componentRules) {
        if ($componentHits.ContainsKey($rule.Target)) { continue }
        $hit = $paths | Where-Object { $rule.Regex.IsMatch($_) } | Select-Object -First 1
        if ($hit) { $componentHits[$rule.Target] = $hit }
    }
    foreach ($target in (Get-Sorted @($componentHits.Keys))) { Add-Signal $target (New-Reason 'component-path' 'body' $componentHits[$target] 1) }

    # Score and choose (suggest.md section 4).
    $scored = foreach ($notation in (Get-Sorted @($reasons.Keys))) {
        if ($carried.Contains($notation)) { continue }
        $list = @($reasons[$notation] | Sort-Object -Stable { [array]::IndexOf($Signals, $_['signal']) })
        $s = 0.0
        foreach ($reason in $list) { $s += $reason['weight'] }
        $score = Get-Round ($s / ($s + 3))
        if ($score -ge $Threshold) { [pscustomobject]@{ Notation = $notation; Score = $score; Reasons = $list } }
    }
    # Score descending, then notation in ordinal order.
    $ranked = [Collections.Generic.List[object]]::new()
    foreach ($item in @($scored)) { if ($null -ne $item) { $ranked.Add($item) } }
    $ranked.Sort([Comparison[object]] { param($a, $b)
            $byScore = $b.Score.CompareTo($a.Score)
            if ($byScore -ne 0) { $byScore } else { [string]::CompareOrdinal($a.Notation, $b.Notation) } })
    $kept = @($ranked | Select-Object -First $MaxSuggestions)
    $chosen = [Collections.Generic.List[object]]::new()
    foreach ($item in $kept) { $chosen.Add($item) }
    foreach ($item in $kept) {
        $top = $vocabulary[$item.Notation]['top']
        if ($top -ne $item.Notation -and -not $carried.Contains($top) -and -not @($chosen | Where-Object Notation -CEQ $top).Count) {
            $chosen.Add([pscustomobject]@{ Notation = $top; Score = $item.Score; Reasons = $item.Reasons })
        }
    }

    [ordered]@{
        path        = $key
        existing    = [string[]]@($document.Subject)
        suggestions = @($chosen | ForEach-Object { [ordered]@{ notation = $_.Notation; score = $_.Score; reasons = @($_.Reasons) } })
    }
}

$version = [regex]::Match([string](Get-Value $registerDocument '$schema') + ' ' + [string](Get-Value $schemeDocument '$schema'), '/subject-vocabulary/([0-9]+\.[0-9]+)/').Groups[1].Value
$result = [ordered]@{
    '$schema' = 'https://jamie-clayton.github.io/githerd-rules/subject-vocabulary/0.9/suggestions.schema.json'
    scheme    = if ($version) { $version } else { '0.9' }
    generator = 'Suggest-Subjects.ps1, Subject Vocabulary Standard 0.9 reference'
    documents = @($output)
}
if ($AsJson) { $result | ConvertTo-Json -Depth 12 } else { [pscustomobject]$result }
