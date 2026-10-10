#Requires -Version 7.4
#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.5.0' }
# The adopter guard must agree with the reference checker
# (.github/conformance/subject-vocabulary-semantic.mjs) on every published
# register example: valid ones pass, and each invalid one fails exactly the
# level and rule its .expected.json names.
# SPDX-License-Identifier: Apache-2.0. Copyright 2026 Jamie Clayton.

BeforeDiscovery {
    $examples = Join-Path $PSScriptRoot '..' 'examples'
    $script:Valid = Get-ChildItem -LiteralPath (Join-Path $examples 'valid') -Filter '*.json' | Sort-Object Name | ForEach-Object { @{ Name = $_.Name; Path = $_.FullName } }
    $script:Invalid = Get-ChildItem -LiteralPath (Join-Path $examples 'invalid') -Filter '*.json' | Where-Object Name -NotLike '*.expected.json' | Sort-Object Name |
        ForEach-Object { @{ Name = $_.Name; Path = $_.FullName; Expected = (Get-Content -LiteralPath ($_.FullName -replace '\.json$', '.expected.json') -Raw | ConvertFrom-Json) } }
}

BeforeAll {
    $script:Guard = Join-Path $PSScriptRoot 'Test-SubjectVocabulary.ps1'
    . $script:Guard
}

Describe 'Test-SubjectVocabulary agrees with the conformance examples' {
    It 'accepts valid/<Name>' -ForEach $script:Valid {
        $result = Invoke-SubjectVocabularyCheck -Path $Path
        @($result.findings) | Should -HaveCount 0 -Because (@($result.findings | ForEach-Object { "$($_.rule) $($_.path) $($_.message)" }) -join "`n")
    }

    It 'rejects invalid/<Name> with <Expected.rule>' -ForEach $script:Invalid {
        $result = Invoke-SubjectVocabularyCheck -Path $Path
        $rules = @($result.findings | ForEach-Object rule | Select-Object -Unique)
        if ($Expected.level -eq 'schema') { $rules | Should -Be @('schema') }
        else { $rules | Should -Be @($Expected.rule) -Because (@($result.findings | ForEach-Object { "$($_.rule) $($_.path) $($_.message)" }) -join "`n") }
    }
}

Describe 'Test-SubjectVocabulary as a command' {
    It 'exits 0 for a conforming register and 2 for a failing one' {
        $examples = Join-Path $PSScriptRoot '..' 'examples'
        pwsh -NoProfile -File $script:Guard -RegisterPath (Join-Path $examples 'valid' 'minimal.json') | Out-Null
        $LASTEXITCODE | Should -Be 0
        pwsh -NoProfile -File $script:Guard -RegisterPath (Join-Path $examples 'invalid' 'broader-cycle.json') | Out-Null
        $LASTEXITCODE | Should -Be 2
    }

    It 'reports a missing register as register-load-failed' {
        (Invoke-SubjectVocabularyCheck -Path (Join-Path $TestDrive 'nope.json')).findings[0].rule | Should -Be 'register-load-failed'
    }

    It 'advises, without failing, on a local concept with no definition' {
        $result = Invoke-SubjectVocabularyCheck -Path (Join-Path $PSScriptRoot '..' 'examples' 'valid' 'retired-local-theme.json')
        @($result.findings) | Should -HaveCount 0
        @($result.advisories).Count | Should -BeGreaterThan 0
    }

    It 'contains no file-writing command' {
        (Get-Content -LiteralPath $script:Guard -Raw) | Should -Not -Match '\b(Set-Content|Out-File|Add-Content|New-Item|Remove-Item|WriteAllText)\b'
    }
}
