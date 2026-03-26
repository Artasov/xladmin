param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("frontend", "backend")]
    [string]$Package,

    [Parameter(Mandatory = $true)]
    [ValidateSet("patch", "minor", "major")]
    [string]$Part,

    [switch]$Push,
    [switch]$DryRun
)

$arguments = @("run", "python", "scripts/release.py", $Package, $Part)
if ($Push) { $arguments += "--push" }
if ($DryRun) { $arguments += "--dry-run" }

uv @arguments
