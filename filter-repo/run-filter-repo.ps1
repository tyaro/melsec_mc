Param(
    [string]$MirrorDir = "$env:TEMP\melsec_mc-mirror",
    [string]$Repo = "https://github.com/tyaro/melsec_mc.git",
    [string]$PathsFile = "$PSScriptRoot\paths-to-remove.txt",
    [string]$ReplaceFile = "$PSScriptRoot\replace-strings.txt"
)
Write-Host "[filter-repo] Mirror clone to $MirrorDir"

# Basic validation of the Repo parameter to catch placeholder values early
if ($Repo -match '[<>]') {
    Write-Error "Repo URL appears to contain placeholder characters ('<' or '>'). Replace '<your-fork>' with your GitHub username or a valid repository URL and retry. Example: https://github.com/your-username/melsec_mc.git"
    exit 1
}
if ($Repo -match '^https?://github.com/.+/.+\.git$' -ne $true) {
    Write-Host "[filter-repo] Warning: Repo value does not look like a typical GitHub HTTPS .git URL: $Repo"
    Write-Host "If this is intentional (SSH URL or private host), ensure you have network and auth configured."
}
Remove-Item -Recurse -Force $MirrorDir -ErrorAction SilentlyContinue
git clone --mirror $Repo $MirrorDir
if ($LASTEXITCODE -ne 0) { Write-Error "git clone --mirror failed"; exit 1 }

Set-Location $MirrorDir

# Locate git-filter-repo or fall back to `python -m git_filter_repo`
$cmd = Get-Command git-filter-repo -ErrorAction SilentlyContinue
$py = Get-Command python -ErrorAction SilentlyContinue
$UsePythonModule = $false
$PythonPath = $null
if ($cmd) {
    Write-Host "[filter-repo] Found 'git-filter-repo' executable: $($cmd.Source)"
} elseif ($py) {
    Write-Host "[filter-repo] 'git-filter-repo' not found; will use 'python -m git_filter_repo' via: $($py.Source)"
    $UsePythonModule = $true
    $PythonPath = $py.Source
} else {
    Write-Error "git-filter-repo not found. Install it with: python -m pip install --user git-filter-repo, or ensure 'git-filter-repo' is on PATH."
    exit 1
}

Write-Host "[filter-repo] Running git-filter-repo (removing paths from $PathsFile)"
if (-not (Test-Path $PathsFile)) { Write-Error "Paths file not found: $PathsFile"; exit 1 }

function Invoke-GitFilterRepo {
    param([string[]]$FilterArgs)
    # Capture output to avoid returning it from the function; only return exit code
    if (-not $UsePythonModule) {
        $null = & git-filter-repo @FilterArgs 2>&1
    } else {
        $null = & $PythonPath '-m' 'git_filter_repo' @FilterArgs 2>&1
    }
    return $LASTEXITCODE
}

# Remove listed paths from history
$rc = Invoke-GitFilterRepo '--paths-from-file', $PathsFile, '--invert-paths'
if ($rc -ne 0) { Write-Error "git-filter-repo (paths) failed (exit $rc)"; exit 1 }

# Optionally replace token-like strings
if (Test-Path $ReplaceFile) {
    Write-Host "[filter-repo] Running replace-text with $ReplaceFile"
    $rc = Invoke-GitFilterRepo '--replace-text', $ReplaceFile
    if ($rc -ne 0) { Write-Error "git-filter-repo (replace-text) failed (exit $rc)"; exit 1 }
}

# Cleanup and GC
& git reflog expire --expire=now --all
& git gc --prune=now --aggressive

# Ensure origin remote exists (git-filter-repo may remove it); restore to $Repo if missing
& git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[filter-repo] 'origin' remote missing after filter-repo; adding origin -> $Repo"
    & git remote add origin $Repo
} else {
    Write-Host "[filter-repo] Ensuring origin URL is set to $Repo"
    & git remote set-url origin $Repo
}

# Push results and save logs (for mirror repositories use --mirror)
$pushHeadsLog = "D:\temp\melsec_mc_filterrepo.push_heads.log"
$pushTagsLog = "D:\temp\melsec_mc_filterrepo.push_tags.log"
Write-Host "[filter-repo] Pushing branches --force (logs -> $pushHeadsLog)"
& git push --force origin 'refs/heads/*:refs/heads/*' 2>&1 | Tee-Object -FilePath $pushHeadsLog
$rcHeads = $LASTEXITCODE
if ($rcHeads -ne 0) {
    Write-Warning "Some branch refs were rejected or failed to push. Check $pushHeadsLog. This can happen for protected or hidden refs (e.g. refs/pull/*)."
}

Write-Host "[filter-repo] Pushing tags --force (logs -> $pushTagsLog)"
& git push --force origin 'refs/tags/*:refs/tags/*' 2>&1 | Tee-Object -FilePath $pushTagsLog
$rcTags = $LASTEXITCODE
if ($rcTags -ne 0) {
    Write-Warning "Some tag refs were rejected or failed to push. Check $pushTagsLog."
}

if ($rcHeads -ne 0 -or $rcTags -ne 0) {
    Write-Error "git push encountered errors - inspect $pushHeadsLog and $pushTagsLog"
    exit 1
}

Write-Host "[filter-repo] Done. Inspect logs: $pushHeadsLog, $pushTagsLog"
