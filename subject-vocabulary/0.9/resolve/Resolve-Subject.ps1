#Requires -Version 7.4
<#
.SYNOPSIS
    Reference resolver for the Subject Vocabulary Standard 0.9.

.DESCRIPTION
    Resolves front-matter subject tokens against a core scheme and a
    repository's adoption register, following resolve.md step by step. Reads
    only the files it is given; never writes. Needs PowerShell 7.4 and no
    modules.

    SPDX-License-Identifier: Apache-2.0. Copyright 2026 Jamie Clayton.

.PARAMETER Scheme
    The core scheme: a path to scheme.json, or the parsed object.

.PARAMETER Register
    The adoption register: a path, the parsed object, or $null for a
    repository without one.

.PARAMETER Token
    The subject tokens to resolve.

.PARAMETER AsJson
    Emit JSON text instead of an object.

.EXAMPLE
    ./Resolve-Subject.ps1 -Scheme ../scheme.json -Register docs/registers/subject-vocabulary.json -Token 'ability:traceability', 'lineage' -AsJson
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [object] $Scheme,

    [AllowNull()]
    [object] $Register,

    [Parameter(Mandatory)]
    [AllowEmptyCollection()]
    [AllowEmptyString()]
    [string[]] $Token,

    [switch] $AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-Document([object] $Value) {
    if ($null -eq $Value) { return $null }
    if ($Value -is [string]) { return Get-Content -LiteralPath $Value -Raw | ConvertFrom-Json -Depth 32 }
    return $Value
}

function Get-Value([object] $Object, [string] $Name) {
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

# Step 3: NFC, simple lowercase per code point, trim, collapse internal white space.
function ConvertTo-NormalisedText([string] $Text) {
    $nfc = $Text.Normalize([Text.NormalizationForm]::FormC)
    return ($nfc.ToLowerInvariant().Trim() -replace '\s+', ' ')
}

$schemeDocument = Read-Document $Scheme
$registerDocument = Read-Document $Register
$replace = (Get-Value $registerDocument 'core') -eq 'replace'

# Step 1: the concept set, hints merged, and the retired set.
$concepts = [ordered]@{}
if (-not $replace) {
    foreach ($concept in @(Get-Value $schemeDocument 'concepts')) {
        $concepts[$concept.notation] = @{ Concept = $concept; Origin = 'core'; Hidden = [Collections.Generic.List[string]]::new() }
    }
}
foreach ($concept in @(Get-Value $registerDocument 'concepts') + @(Get-Value $registerDocument 'components')) {
    if ($null -eq $concept) { continue }
    $concepts[$concept.notation] = @{ Concept = $concept; Origin = 'local'; Hidden = [Collections.Generic.List[string]]::new() }
}
$hints = Get-Value $registerDocument 'hints'
foreach ($entry in $concepts.Values) {
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $labels = @(Get-Value $entry.Concept 'hiddenLabel') + @(Get-Value (Get-Value $hints $entry.Concept.notation) 'hiddenLabel')
    foreach ($label in $labels) {
        if ($null -ne $label -and $seen.Add((ConvertTo-NormalisedText $label))) { $entry.Hidden.Add($label) }
    }
}
$retired = @{}
$retiredEntries = @(Get-Value $registerDocument 'retired')
if (-not $replace) { $retiredEntries += @(Get-Value $schemeDocument 'retired') }
foreach ($entry in $retiredEntries) {
    if ($null -ne $entry) { $retired[$entry.notation] = $entry.isReplacedBy }
}

# Step 2: the prefix set.
$declared = Get-Value $registerDocument 'prefixes'
if ($null -eq $declared) { $declared = @('theme', 'component') }
$prefixes = [Collections.Generic.HashSet[string]]::new([string[]](@('ability') + @($declared)), [StringComparer]::Ordinal)

# Step 7: the top concept.
function Get-Top([string] $Notation) {
    $current = $Notation
    $visited = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    while ($visited.Add($current)) {
        $broader = @(Get-Value $concepts[$current].Concept 'broader')
        if ($broader.Count -eq 0 -or $null -eq $broader[0] -or -not $concepts.Contains($broader[0])) { break }
        $current = $broader[0]
    }
    return $current
}

$ordinal = [StringComparer]::Ordinal
$legacy = @{}
$legacyMap = Get-Value $registerDocument 'legacy'
if ($null -ne $legacyMap) {
    foreach ($property in $legacyMap.PSObject.Properties) { $legacy[(ConvertTo-NormalisedText $property.Name)] = $property.Value }
}
$labelOwners = @{}
foreach ($notation in $concepts.Keys) {
    $concept = $concepts[$notation].Concept
    $names = @(Get-Value $concept 'prefLabel') + @(Get-Value $concept 'altLabel')
    foreach ($key in ($names | Where-Object { $null -ne $_ } | ForEach-Object { ConvertTo-NormalisedText $_ } | Select-Object -Unique)) {
        if (-not $labelOwners.ContainsKey($key)) { $labelOwners[$key] = [Collections.Generic.List[string]]::new() }
        $labelOwners[$key].Add($notation)
    }
}

function Complete-Resolution([System.Collections.Specialized.OrderedDictionary] $Resolution, [string] $Notation) {
    $Resolution['notation'] = $Notation
    if ($concepts.Contains($Notation)) {
        $Resolution['origin'] = $concepts[$Notation].Origin
        $Resolution['top'] = Get-Top $Notation
    }
    return $Resolution
}

$resolutions = foreach ($raw in $Token) {
    $normalised = ConvertTo-NormalisedText $raw
    $resolution = [ordered]@{ token = $raw; normalised = $normalised }
    $isPrefixed = $normalised -cmatch '^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$' -and $prefixes.Contains($normalised.Split(':')[0])

    if ($isPrefixed) {
        # Step 5.
        $resolution['kind'] = 'prefixed'
        if ($concepts.Contains($normalised)) {
            $resolution['status'] = 'active'
            Complete-Resolution $resolution $normalised
        }
        elseif ($retired.ContainsKey($normalised)) {
            $resolution['status'] = 'retired'
            $resolution['retired'] = $normalised
            Complete-Resolution $resolution $retired[$normalised]
        }
        else {
            $resolution['status'] = 'unknown'
            if ($replace -and $normalised.StartsWith('ability:', [StringComparison]::Ordinal)) {
                $matched = [string[]]@($concepts.Keys | Where-Object {
                        $local = $_
                        @(Get-Value $concepts[$local].Concept 'exactMatch') | Where-Object { $null -ne $_ -and $_.scheme -eq 'core' -and $_.notation -eq $normalised }
                    })
                if ($matched.Count -gt 0) { [Array]::Sort($matched, $ordinal); $resolution['suggestion'] = $matched[0] }
            }
            $resolution
        }
    }
    else {
        # Step 6.
        $resolution['kind'] = 'keyword'
        if ($legacy.ContainsKey($normalised)) {
            $target = $legacy[$normalised]
            $resolution['status'] = 'legacy'
            if (-not $concepts.Contains($target) -and $retired.ContainsKey($target)) { $target = $retired[$target] }
            Complete-Resolution $resolution $target
        }
        elseif ($labelOwners.ContainsKey($normalised) -and $labelOwners[$normalised].Count -eq 1) {
            $resolution['status'] = 'label'
            Complete-Resolution $resolution $labelOwners[$normalised][0]
        }
        elseif ($labelOwners.ContainsKey($normalised)) {
            $candidates = [string[]]$labelOwners[$normalised].ToArray()
            [Array]::Sort($candidates, $ordinal)
            $resolution['status'] = 'ambiguous'
            $resolution['candidates'] = $candidates
            $resolution
        }
        else {
            $resolution['status'] = 'unknown'
            $resolution
        }
    }
}

$notations = [string[]]@($concepts.Keys)
[Array]::Sort($notations, $ordinal)
$vocabulary = foreach ($notation in $notations) {
    [ordered]@{
        notation    = $notation
        origin      = $concepts[$notation].Origin
        top         = Get-Top $notation
        hiddenLabel = [string[]]$concepts[$notation].Hidden.ToArray()
    }
}

$result = [ordered]@{
    vocabulary  = @($vocabulary)
    resolutions = @($resolutions)
}
if ($AsJson) { $result | ConvertTo-Json -Depth 10 } else { [pscustomobject]$result }
