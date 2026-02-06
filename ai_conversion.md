
Get-ChildItem -Recurse | 
    Where-Object { 
        $_.FullName -notmatch '\\(\.next|node_modules|__pycache__|\.git|cache|turbopack|static|playwright-report|public|\.venv|dist|build|.*\.sst|.*\.meta|.*\.png|.*\.svg|.*\.txt)\\' -and
        $_.Name -notmatch '\.(sst|meta|png|svg|pyc|log)$'
    } | 
    ForEach-Object { 
        $relativePath = $_.FullName.Replace((Get-Location).Path, "")
        $depth = ($relativePath.ToCharArray() | Where-Object { $_ -eq [char]'\' }).Count
        "  " * ($depth - 1) + $_.Name 
    }
```