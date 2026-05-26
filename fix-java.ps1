$javaHome = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.6.7-hotspot'

if (-not (Test-Path $javaHome)) {
    throw "Java 21 not found at $javaHome"
}

$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;" + $env:Path

Write-Host "Using Java 21 from $javaHome" -ForegroundColor Cyan
