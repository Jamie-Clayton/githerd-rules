#Requires -Version 7.4
<#
.SYNOPSIS
    Checks a repository's subject vocabulary adoption register against the
    Subject Vocabulary Standard 0.9 it pins, offline.

.DESCRIPTION
    The adopter guard of the standard (spec.md, Conformance). Run it from the
    vendored copy of the standard's version folder: it reads the schemas and
    the core scheme beside it, so it needs no network and no module beyond
    PowerShell 7.4 (Test-Json supports JSON Schema 2020-12).

    Reports one finding per problem, in this order:

      register-load-failed  The register is missing or is not JSON.
      SV006                 $schema does not pin this vendored version.
      schema                The register breaks the JSON Schema.
      SV001 to SV009        The semantic rules JSON Schema cannot express
                            (run only on a schema-valid register).

    Advisories (a local concept without a definition) never block.
    Exits 0 when nothing blocks and 2 otherwise. Never writes.

    Dot-source the script to load its functions without running it.

    SPDX-License-Identifier: Apache-2.0. Copyright 2026 Jamie Clayton.

.PARAMETER RegisterPath
    The adoption register, usually docs/registers/subject-vocabulary.json.

.PARAMETER AsJson
    Emit the findings as JSON.

.EXAMPLE
    pwsh schemas/vendor/subject-vocabulary/0.9/check/Test-SubjectVocabulary.ps1 -RegisterPath docs/registers/subject-vocabulary.json
#>
[CmdletBinding()]
param(
    [string] $RegisterPath,

    [switch] $AsJson
)

Set-StrictMode -Version Latest

$script:VersionFolder = Split-Path -Parent $PSScriptRoot
$script:Core = 'ability:'
$script:DefaultPrefixes = @('theme', 'component')
$script:PinPattern = '^https://jamie-clayton\.github\.io/githerd-rules/subject-vocabulary/(?<version>[0-9]+\.[0-9]+)/subject-vocabulary\.schema\.json$'

function Get-Value([object] $Object, [string] $Name) {
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Get-List([object] $Object, [string] $Name) {
    return , @(@(Get-Value $Object $Name) | Where-Object { $null -ne $_ })
}

# Label normalisation, resolve.md step 3.
function ConvertTo-Folded([string] $Text) {
    return ($Text.Normalize([Text.NormalizationForm]::FormC).ToLowerInvariant().Trim() -replace '\s+', ' ')
}

function New-OrdinalMap { , [Collections.Generic.Dictionary[string, object]]::new([StringComparer]::Ordinal) }
function New-OrdinalSet { , [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal) }

function Get-PrefixOf([string] $Notation) { $Notation.Substring(0, $Notation.IndexOf(':')) }

function Test-SubjectVocabularyRegister {
    <#
    .SYNOPSIS
        Semantic rules SV001 to SV009 for a schema-valid register; returns findings.
    #>
    param(
        [Parameter(Mandatory)] [object] $Register,
        [Parameter(Mandatory)] [object] $Scheme,
        [Parameter(Mandatory)] [string[]] $PublishedVersions
    )
    $findings = [Collections.Generic.List[object]]::new()
    $add = { param($Rule, $Path, $Message) $findings.Add([pscustomobject]@{ rule = $Rule; path = $Path; message = $Message }) }

    $replace = (Get-Value $Register 'core') -eq 'replace'
    $declaredList = Get-Value $Register 'prefixes'
    $declared = New-OrdinalSet
    foreach ($prefix in @(if ($null -eq $declaredList) { $script:DefaultPrefixes } else { $declaredList })) { [void]$declared.Add($prefix) }
    $coreConcepts = Get-List $Scheme 'concepts'
    $core = New-OrdinalMap
    foreach ($concept in $coreConcepts) { $core[$concept.notation] = $concept }

    $locals = [Collections.Generic.List[object]]::new()
    $i = 0; foreach ($concept in (Get-List $Register 'concepts')) { $locals.Add([pscustomobject]@{ Concept = $concept; Path = "/concepts/$i" }); $i++ }
    $i = 0; foreach ($concept in (Get-List $Register 'components')) { $locals.Add([pscustomobject]@{ Concept = $concept; Path = "/components/$i" }); $i++ }
    $hints = Get-Value $Register 'hints'
    $hintKeys = @(if ($null -ne $hints) { $hints.PSObject.Properties.Name })
    $legacy = Get-Value $Register 'legacy'
    $legacyPairs = @(if ($null -ne $legacy) { $legacy.PSObject.Properties | ForEach-Object { [pscustomobject]@{ Key = $_.Name; Target = $_.Value } } })

    # SV002 and SV004: what a local entry may be called.
    $valid = [Collections.Generic.List[object]]::new()
    foreach ($entry in $locals) {
        $notation = $entry.Concept.notation
        if ($notation.StartsWith($script:Core, [StringComparison]::Ordinal)) {
            $message = if ($replace) { "'$notation': this register replaces the core, so it may not use ability: notations." }
            elseif ($core.ContainsKey($notation)) { "'$notation' is a core concept; a register may add hints to it but not redefine it." }
            else { "'$notation' adds an ability; only the core scheme defines abilities." }
            & $add 'SV002' "$($entry.Path)/notation" $message
        }
        elseif (-not $declared.Contains((Get-PrefixOf $notation))) {
            & $add 'SV004' "$($entry.Path)/notation" "'$notation' uses the prefix '$(Get-PrefixOf $notation)', which the register does not declare in prefixes."
        }
        else { $valid.Add($entry) }
    }
    foreach ($key in $hintKeys) {
        if (-not $key.StartsWith($script:Core, [StringComparison]::Ordinal)) { continue }
        if ($replace) { & $add 'SV002' "/hints/$key" "Hint for '$key': this register replaces the core." }
        elseif (-not $core.ContainsKey($key)) { & $add 'SV002' "/hints/$key" "Hint for '$key', which the core scheme does not define." }
    }
    if ($replace) {
        foreach ($pair in $legacyPairs) {
            if ($pair.Target.StartsWith($script:Core, [StringComparison]::Ordinal)) { & $add 'SV002' "/legacy/$($pair.Key)" "Legacy target '$($pair.Target)': this register replaces the core." }
        }
    }
    foreach ($entry in $valid) {
        foreach ($key in 'exactMatch', 'closeMatch') {
            foreach ($match in (Get-List $entry.Concept $key)) {
                if ($match.scheme -cne 'core') { continue }
                if (-not $core.ContainsKey($match.notation)) { & $add 'SV002' "$($entry.Path)/$key" "Core match '$($match.notation)' is not an active concept of the core scheme." }
                elseif ($key -eq 'exactMatch' -and -not $replace) { & $add 'SV002' "$($entry.Path)/exactMatch" "Exact match to '$($match.notation)' while extending the core: make it the broader concept instead." }
            }
        }
    }

    # SV001: references and chains over the resolved vocabulary.
    $active = New-OrdinalSet
    if (-not $replace) { foreach ($notation in $core.Keys) { [void]$active.Add($notation) } }
    foreach ($entry in $valid) { [void]$active.Add($entry.Concept.notation) }
    foreach ($entry in $valid) {
        foreach ($key in 'broader', 'narrower', 'related') {
            foreach ($target in (Get-List $entry.Concept $key)) {
                if (-not $active.Contains($target)) { & $add 'SV001' "$($entry.Path)/$key" "'$target' is not an active concept." }
            }
        }
    }
    foreach ($key in $hintKeys) {
        if (-not $key.StartsWith($script:Core, [StringComparison]::Ordinal) -and -not $active.Contains($key)) { & $add 'SV001' "/hints/$key" "Hint for '$key', which is not an active concept." }
    }
    $byNotation = New-OrdinalMap
    foreach ($entry in $valid) { $byNotation[$entry.Concept.notation] = $entry }
    foreach ($notation in @($byNotation.Keys)) {
        $seen = New-OrdinalSet; [void]$seen.Add($notation)
        $current = $byNotation[$notation].Concept
        while ((Get-List $current 'broader').Count -gt 0) {
            $next = @((Get-List $current 'broader') | Where-Object { $byNotation.ContainsKey($_) }) | Select-Object -First 1
            if ($null -eq $next) { break }
            if ($seen.Contains($next)) { & $add 'SV001' "$($byNotation[$notation].Path)/broader" "Local concept '$notation' has a broader cycle through '$next'."; break }
            [void]$seen.Add($next)
            $current = $byNotation[$next].Concept
        }
    }
    if ($replace -and -not @($valid | Where-Object { (Get-List $_.Concept 'broader').Count -eq 0 }).Count) {
        & $add 'SV001' '/concepts' 'This register replaces the core, so at least one local concept must be a top concept (no broader).'
    }

    # SV003: retirement.
    $i = 0
    foreach ($entry in (Get-List $Register 'retired')) {
        if ($active.Contains($entry.notation)) { & $add 'SV003' "/retired/$i/notation" "'$($entry.notation)' is both active and retired." }
        elseif (-not $active.Contains($entry.isReplacedBy)) { & $add 'SV003' "/retired/$i/isReplacedBy" "'$($entry.isReplacedBy)' is not an active concept." }
        $i++
    }

    # SV005: altLabels and legacy keys against notations and prefLabels (last owner wins, as the reference).
    $owners = @{}
    $labelEntries = @(
        if (-not $replace) { foreach ($concept in $coreConcepts) { [pscustomobject]@{ Notation = $concept.notation; PrefLabel = $concept.prefLabel; AltLabel = @(); Path = '(core)' } } }
        foreach ($entry in $valid) { [pscustomobject]@{ Notation = $entry.Concept.notation; PrefLabel = (Get-Value $entry.Concept 'prefLabel'); AltLabel = (Get-List $entry.Concept 'altLabel'); Path = $entry.Path } }
    )
    foreach ($e in $labelEntries) {
        $owners[(ConvertTo-Folded $e.Notation)] = $e.Notation
        if ($e.PrefLabel) { $owners[(ConvertTo-Folded $e.PrefLabel)] = $e.Notation }
    }
    foreach ($e in $labelEntries) {
        foreach ($label in $e.AltLabel) {
            $owner = $owners[(ConvertTo-Folded $label)]
            if ($owner -and $owner -cne $e.Notation) { & $add 'SV005' "$($e.Path)/altLabel" "altLabel '$label' is the notation or prefLabel of '$owner'."; break }
        }
    }
    foreach ($pair in $legacyPairs) {
        $owner = $owners[(ConvertTo-Folded $pair.Key)]
        if ($owner -and $owner -cne $pair.Target) { & $add 'SV005' "/legacy/$($pair.Key)" "Legacy key '$($pair.Key)' is the notation or prefLabel of '$owner'." }
    }

    # SV007: one broader at most.
    foreach ($entry in $valid) {
        $count = (Get-List $entry.Concept 'broader').Count
        if ($count -gt 1) { & $add 'SV007' "$($entry.Path)/broader" "'$($entry.Concept.notation)' has $count broader concepts; at most one is allowed." }
    }

    # SV008: local labels against core labels.
    $hinted = { param($Notation) if ($null -ne $hints -and $hints.PSObject.Properties[$Notation]) { @(Get-List $hints.$Notation 'hiddenLabel') } else { @() } }
    $coreLabels = @{}
    foreach ($concept in $coreConcepts) {
        foreach ($pair in @(
                @{ Kind = 'pref'; Labels = @($concept.prefLabel) },
                @{ Kind = 'alt'; Labels = (Get-List $concept 'altLabel') },
                @{ Kind = 'hidden'; Labels = @((Get-List $concept 'hiddenLabel') + @(if (-not $replace) { & $hinted $concept.notation })) })) {
            foreach ($label in $pair.Labels) { $coreLabels[(ConvertTo-Folded $label)] = @{ Notation = $concept.notation; Kind = $pair.Kind } }
        }
    }
    foreach ($entry in $valid) {
        $c = $entry.Concept
        $matched = New-OrdinalSet
        foreach ($match in @((Get-List $c 'exactMatch') + (Get-List $c 'closeMatch'))) { if ($match.scheme -ceq 'core') { [void]$matched.Add($match.notation) } }
        $clash = $null
        foreach ($pair in @(
                @{ Kind = 'pref'; Labels = @(Get-Value $c 'prefLabel') },
                @{ Kind = 'alt'; Labels = (Get-List $c 'altLabel') },
                @{ Kind = 'hidden'; Labels = (Get-List $c 'hiddenLabel') })) {
            foreach ($label in $pair.Labels) {
                if (-not $label) { continue }
                $hit = $coreLabels[(ConvertTo-Folded $label)]
                if ($hit -and -not ($pair.Kind -eq 'alt' -and $hit.Kind -eq 'pref') -and -not ($replace -and $matched.Contains($hit.Notation))) { $clash = @{ Label = $label; Notation = $hit.Notation }; break }
            }
            if ($clash) { break }
        }
        if ($clash) {
            $message = if ($replace) { "'$($c.notation)' uses the core label '$($clash.Label)' of '$($clash.Notation)' without a core exactMatch or closeMatch to it." }
            else { "'$($c.notation)' uses the label '$($clash.Label)', which belongs to the core concept '$($clash.Notation)'." }
            & $add 'SV008' $entry.Path $message
        }
    }

    # SV009: legacy targets, and labels owned twice (hints merged in; first owner wins, as the reference).
    $retiredLocal = @{}
    foreach ($entry in (Get-List $Register 'retired')) { $retiredLocal[$entry.notation] = $entry.isReplacedBy }
    foreach ($pair in $legacyPairs) {
        if ($replace -and $pair.Target.StartsWith($script:Core, [StringComparison]::Ordinal)) { continue }
        if ($active.Contains($pair.Target)) { continue }
        $message = if ($retiredLocal.ContainsKey($pair.Target)) { "Legacy target '$($pair.Target)' is retired; use '$($retiredLocal[$pair.Target])'." } else { "Legacy target '$($pair.Target)' is not an active concept." }
        & $add 'SV009' "/legacy/$($pair.Key)" $message
    }
    $shared = @(
        if (-not $replace) {
            foreach ($concept in $coreConcepts) {
                $extra = @(& $hinted $concept.notation)
                [pscustomobject]@{ Notation = $concept.notation; PrefLabel = $concept.prefLabel; Labels = @(@($concept.prefLabel) + (Get-List $concept 'altLabel') + (Get-List $concept 'hiddenLabel') + $extra); Path = $(if ($extra.Count) { "/hints/$($concept.notation)" } else { '(core)' }); IsCore = $true }
            }
        }
        foreach ($entry in $valid) {
            $c = $entry.Concept
            [pscustomobject]@{ Notation = $c.notation; PrefLabel = (Get-Value $c 'prefLabel'); Labels = @(@(Get-Value $c 'prefLabel') + (Get-List $c 'altLabel') + (Get-List $c 'hiddenLabel') + @(& $hinted $c.notation)); Path = $entry.Path; IsCore = $false }
        }
    )
    $isCore = @{}; foreach ($s in $shared) { $isCore[$s.Notation] = $s.IsCore }
    $firstOwner = @{}
    foreach ($s in $shared) {
        $labels = @($s.Labels | Where-Object { $_ })
        $keys = [Collections.Generic.List[string]]::new()
        foreach ($label in $labels) { $key = ConvertTo-Folded $label; if (-not $keys.Contains($key)) { $keys.Add($key) } }
        foreach ($key in $keys) {
            if (-not $firstOwner.ContainsKey($key)) { $firstOwner[$key] = $s.Notation; continue }
            $owner = $firstOwner[$key]
            if ($owner -ceq $s.Notation) { continue }
            # Under extend a local label equal to a core label is SV008's.
            if (-not $replace -and $isCore[$owner] -ne $isCore[$s.Notation]) { continue }
            if (@($labels | Where-Object { (ConvertTo-Folded $_) -ceq $key -and $_ -cne $s.PrefLabel }).Count) {
                & $add 'SV009' $s.Path "Label '$key' belongs to both '$owner' and '$($s.Notation)'."; break
            }
        }
    }

    # SV006: the pin names a published version.
    $pinned = [regex]::Match([string](Get-Value $Register '$schema'), '/subject-vocabulary/([0-9]+\.[0-9]+)/').Groups[1].Value
    if ($PublishedVersions -notcontains $pinned) { & $add 'SV006' '/$schema' "Version $pinned of the standard has not been published." }

    return , $findings
}

function Invoke-SubjectVocabularyCheck {
    <#
    .SYNOPSIS
        Runs every check on a register file against the vendored version beside this script.
    #>
    param([Parameter(Mandatory)] [string] $Path)
    $version = Split-Path -Leaf $script:VersionFolder
    $result = [ordered]@{ register = $Path; version = $version; findings = [Collections.Generic.List[object]]::new(); advisories = [Collections.Generic.List[object]]::new() }
    $finding = { param($Rule, $Pointer, $Message) $result.findings.Add([pscustomobject]@{ rule = $Rule; path = $Pointer; message = $Message }) }

    try { $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop; $register = $raw | ConvertFrom-Json -Depth 64 -ErrorAction Stop }
    catch { & $finding 'register-load-failed' '' "The register could not be read as JSON: $($_.Exception.Message)"; return [pscustomobject]$result }

    $pin = [regex]::Match([string](Get-Value $register '$schema'), $script:PinPattern)
    if ($pin.Success -and $pin.Groups['version'].Value -ne $version) {
        & $finding 'SV006' '/$schema' "The register pins $($pin.Groups['version'].Value), but this copy of the standard is $version; vendor the pinned version."
        return [pscustomobject]$result
    }

    $schemaErrors = $null
    $schemaValid = Test-Json -Json $raw -SchemaFile (Join-Path $script:VersionFolder 'subject-vocabulary.schema.json') -ErrorAction SilentlyContinue -ErrorVariable schemaErrors
    if (-not $schemaValid) {
        & $finding 'schema' '' ("The register breaks the JSON Schema: " + (@($schemaErrors | ForEach-Object { $_.Exception.Message }) -join '; '))
        return [pscustomobject]$result
    }

    $scheme = Get-Content -LiteralPath (Join-Path $script:VersionFolder 'scheme.json') -Raw | ConvertFrom-Json -Depth 64
    foreach ($item in (Test-SubjectVocabularyRegister -Register $register -Scheme $scheme -PublishedVersions @($version))) { $result.findings.Add($item) }
    $i = 0
    foreach ($concept in (Get-List $register 'concepts')) {
        if (-not (Get-Value $concept 'definition')) { $result.advisories.Add([pscustomobject]@{ path = "/concepts/$i"; message = "'$($concept.notation)' has no definition; a promise helps people and suggesters choose it." }) }
        $i++
    }
    return [pscustomobject]$result
}

if ($MyInvocation.InvocationName -ne '.') {
    if (-not $RegisterPath) { throw 'RegisterPath is required.' }
    $outcome = Invoke-SubjectVocabularyCheck -Path $RegisterPath
    if ($AsJson) { $outcome | ConvertTo-Json -Depth 8 }
    else {
        foreach ($item in $outcome.findings) { Write-Output ("{0} {1} {2}" -f $item.rule, $item.path, $item.message) }
        foreach ($item in $outcome.advisories) { Write-Output ("advisory {0} {1}" -f $item.path, $item.message) }
        if (-not $outcome.findings.Count) { Write-Output "Subject vocabulary register conforms to $($outcome.version)." }
    }
    exit $(if ($outcome.findings.Count) { 2 } else { 0 })
}
