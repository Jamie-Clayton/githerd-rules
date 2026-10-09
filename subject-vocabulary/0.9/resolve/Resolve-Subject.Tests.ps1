#Requires -Version 7.4
#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.5.0' }
# Runs every resolver fixture through the reference resolver. A resolver in
# another language conforms when it passes the same fixtures (resolve.md).
# SPDX-License-Identifier: Apache-2.0. Copyright 2026 Jamie Clayton.

BeforeDiscovery {
    $script:Fixtures = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'fixtures') -Filter '*.json' |
        Sort-Object Name |
        ForEach-Object { @{ Name = $_.BaseName; Path = $_.FullName } }
}

BeforeAll {
    $script:Resolver = Join-Path $PSScriptRoot 'Resolve-Subject.ps1'
    $script:PublishedScheme = Join-Path $PSScriptRoot '..' 'scheme.json'

    # Equal as JSON values, ignoring key order: sort keys, then compare text.
    function ConvertTo-CanonicalJson([object] $Value) {
        function Sort-Keys([object] $Node) {
            if ($Node -is [System.Collections.IDictionary]) {
                $sorted = [ordered]@{}
                foreach ($key in ($Node.Keys | Sort-Object -CaseSensitive)) { $sorted[$key] = Sort-Keys $Node[$key] }
                return $sorted
            }
            if ($Node -is [System.Collections.IList]) { return , @($Node | ForEach-Object { Sort-Keys $_ }) }
            return $Node
        }
        $tree = $Value | ConvertTo-Json -Depth 32 | ConvertFrom-Json -AsHashtable -Depth 32
        return (Sort-Keys $tree) | ConvertTo-Json -Depth 32 -Compress
    }
}

Describe 'Resolve-Subject fixtures' {
    It '<Name>' -ForEach $script:Fixtures {
        $fixture = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json -Depth 32
        $scheme = if ($fixture.scheme -is [string]) { $script:PublishedScheme } else { $fixture.scheme }

        $actual = & $script:Resolver -Scheme $scheme -Register $fixture.register -Token ([string[]]@($fixture.tokens))

        $expected = $fixture.expected
        ConvertTo-CanonicalJson @($actual.resolutions) | Should -BeExactly (ConvertTo-CanonicalJson @($expected.resolutions)) -Because $fixture.description
        if ($expected.PSObject.Properties['vocabulary']) {
            ConvertTo-CanonicalJson @($actual.vocabulary) | Should -BeExactly (ConvertTo-CanonicalJson @($expected.vocabulary)) -Because $fixture.description
        }
    }
}

Describe 'Resolve-Subject safety' {
    It 'has no parameter that writes' {
        $parameters = (Get-Command $script:Resolver).Parameters.Keys
        $parameters | Should -Not -Contain 'OutFile'
        $parameters | Should -Not -Contain 'Path'
        (Get-Content -LiteralPath $script:Resolver -Raw) | Should -Not -Match '\b(Set-Content|Out-File|Add-Content|New-Item|Remove-Item)\b'
    }

    It 'emits JSON with -AsJson' {
        $json = & $script:Resolver -Scheme $script:PublishedScheme -Register $null -Token 'ability:traceability' -AsJson
        ($json | ConvertFrom-Json).resolutions[0].status | Should -Be 'active'
    }
}
