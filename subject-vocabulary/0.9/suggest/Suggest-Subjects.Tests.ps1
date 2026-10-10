#Requires -Version 7.4
#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.5.0' }, @{ ModuleName = 'powershell-yaml'; ModuleVersion = '0.4.0' }
# Runs every golden fixture through the reference suggester. A suggester in
# another language conforms when it produces the same documents (suggest.md).
# SPDX-License-Identifier: Apache-2.0. Copyright 2026 Jamie Clayton.

BeforeDiscovery {
    $script:Fixtures = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'fixtures') -Directory |
        Sort-Object Name |
        ForEach-Object { @{ Name = $_.Name; Path = $_.FullName } }
}

BeforeAll {
    $script:Suggester = Join-Path $PSScriptRoot 'Suggest-Subjects.ps1'

    # Equal as JSON values, ignoring key order: sort keys, then compare text.
    function ConvertTo-CanonicalJson([object] $Value) {
        function Sort-Keys([object] $Node) {
            if ($Node -is [System.Collections.IDictionary]) {
                $sorted = [ordered]@{}
                foreach ($key in ($Node.Keys | Sort-Object -CaseSensitive)) { $sorted[$key] = Sort-Keys $Node[$key] }
                return $sorted
            }
            if ($Node -is [System.Collections.IList]) { return , @($Node | ForEach-Object { Sort-Keys $_ }) }
            # 3 and 3.0 are the same JSON number.
            if ($Node -is [int] -or $Node -is [long] -or $Node -is [double] -or $Node -is [decimal]) { return [double]$Node }
            return $Node
        }
        $tree = $Value | ConvertTo-Json -Depth 32 | ConvertFrom-Json -AsHashtable -Depth 32
        return (Sort-Keys $tree) | ConvertTo-Json -Depth 32 -Compress
    }

    function Invoke-Fixture([string] $Folder) {
        $fixture = Get-Content -LiteralPath (Join-Path $Folder 'fixture.json') -Raw | ConvertFrom-Json -Depth 32
        $arguments = @{
            Path           = 'docs'
            RepositoryRoot = $Folder
            Scheme         = $fixture.scheme
            Register       = $fixture.register
        }
        $options = $fixture.options
        if ($options.PSObject.Properties['withLinks'] -and $options.withLinks) { $arguments.WithLinks = $true }
        if ($options.PSObject.Properties['definitionWeight']) { $arguments.DefinitionWeight = $options.definitionWeight }
        if ($options.PSObject.Properties['hideExistingSubjects'] -and $options.hideExistingSubjects) { $arguments.HideExistingSubjects = $true }
        Push-Location $Folder
        try { $actual = & $script:Suggester @arguments }
        finally { Pop-Location }
        return @{ Fixture = $fixture; Actual = $actual }
    }
}

Describe 'Suggest-Subjects golden fixtures' {
    It '<Name>' -ForEach $script:Fixtures {
        $run = Invoke-Fixture $Path
        $expected = $run.Fixture.expected
        $run.Actual.scheme | Should -Be $expected.scheme
        ConvertTo-CanonicalJson @($run.Actual.documents) | Should -BeExactly (ConvertTo-CanonicalJson @($expected.documents)) -Because $run.Fixture.description
    }

    It 'gives the same output twice for the same inputs' {
        $folder = Join-Path $PSScriptRoot 'fixtures' '01-text-signals'
        $first = ConvertTo-CanonicalJson (Invoke-Fixture $folder).Actual
        $second = ConvertTo-CanonicalJson (Invoke-Fixture $folder).Actual
        $second | Should -BeExactly $first
    }
}

Describe 'Suggest-Subjects recall floor' {
    It 'holds every concept within 0.05 of its baseline on the synthetic corpus' {
        $folder = Join-Path $PSScriptRoot 'recall'
        $baseline = Get-Content -LiteralPath (Join-Path $folder 'baseline.json') -Raw | ConvertFrom-Json -AsHashtable
        Push-Location $folder
        try { $result = & $script:Suggester -Path 'docs' -RepositoryRoot $folder -Register $null -HideExistingSubjects -DefinitionWeight $baseline.definitionWeight }
        finally { Pop-Location }
        $tagged = @{}; $hits = @{}
        foreach ($document in $result.documents) {
            $suggested = @($document.suggestions | ForEach-Object { $_['notation'] })
            foreach ($concept in $document.existing) {
                $tagged[$concept] = 1 + [int]$tagged[$concept]
                if ($suggested -contains $concept) { $hits[$concept] = 1 + [int]$hits[$concept] }
            }
        }
        foreach ($concept in $baseline.recall.Keys) {
            $recall = [Math]::Round([int]$hits[$concept] / $tagged[$concept], 2)
            $recall | Should -BeGreaterOrEqual ($baseline.recall[$concept] - 0.05) -Because "$concept recall on the synthetic corpus"
        }
    }
}

Describe 'Suggest-Subjects never writes' {
    It 'has no parameter that names an output' {
        $parameters = (Get-Command $script:Suggester).Parameters.Keys
        foreach ($name in 'OutFile', 'OutputPath', 'Destination', 'Write', 'Apply', 'Force') { $parameters | Should -Not -Contain $name }
    }

    It 'contains no file-writing command' {
        (Get-Content -LiteralPath $script:Suggester -Raw) | Should -Not -Match '\b(Set-Content|Out-File|Add-Content|New-Item|Remove-Item|Copy-Item|Move-Item|WriteAllText|WriteAllLines|WriteAllBytes)\b'
    }

    It 'leaves the documents byte for byte unchanged' {
        $folder = Join-Path $PSScriptRoot 'fixtures' '01-text-signals'
        $before = Get-ChildItem -LiteralPath (Join-Path $folder 'docs') -File | ForEach-Object { (Get-FileHash -LiteralPath $_.FullName).Hash }
        $null = Invoke-Fixture $folder
        $after = Get-ChildItem -LiteralPath (Join-Path $folder 'docs') -File | ForEach-Object { (Get-FileHash -LiteralPath $_.FullName).Hash }
        $after | Should -Be $before
    }
}
