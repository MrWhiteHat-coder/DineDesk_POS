param([string]$Root)
$files = Get-ChildItem -Path $Root -Recurse -Include *.jsx,*.js,*.css | Where-Object { $_.FullName -notmatch '\\node_modules\\' }
$totalChanged = 0
foreach ($f in $files) {
    $orig = Get-Content -Raw -Path $f.FullName
    $text = $orig
    # bg-black -> bg-yellow-400 (primary highlight/buttons)
    $text = $text -replace 'bg-black\b', 'bg-yellow-400'
    # hover:bg-gray-800 -> hover:bg-yellow-300 (primary button hover)
    $text = $text -replace 'hover:bg-gray-800\b', 'hover:bg-yellow-300'
    # text-white stays text-white in many cases (yellow-on-dark still uses white text usually)
    # Replace specific contexts: secondary surfaces
    # bg-slate-900 / bg-slate-950 -> bg-neutral-900 (dark sidebar if needed)
    $text = $text -replace 'bg-slate-900\b', 'bg-neutral-900'
    $text = $text -replace 'bg-slate-950\b', 'bg-neutral-950'
    # text-slate-... -> text-neutral-...
    $text = $text -replace 'text-slate-900\b', 'text-neutral-900'
    $text = $text -replace 'text-slate-800\b', 'text-neutral-800'
    $text = $text -replace 'text-slate-700\b', 'text-neutral-700'
    $text = $text -replace 'text-slate-600\b', 'text-neutral-600'
    $text = $text -replace 'text-slate-500\b', 'text-neutral-500'
    $text = $text -replace 'text-slate-400\b', 'text-neutral-400'
    # bg-slate-50 -> bg-yellow-50 (page background tint)
    $text = $text -replace 'bg-slate-50\b', 'bg-yellow-50'
    # bg-slate-100 / bg-slate-200 (badges/skeletons) -> green-50 / yellow-100
    $text = $text -replace 'bg-slate-100\b', 'bg-yellow-100'
    $text = $text -replace 'bg-slate-200\b', 'bg-green-100'
    # borders
    $text = $text -replace 'border-slate-200\b', 'border-yellow-200'
    $text = $text -replace 'border-slate-300\b', 'border-yellow-300'
    # gray-* -> neutral-*
    $text = $text -replace 'bg-gray-50\b', 'bg-yellow-50'
    $text = $text -replace 'bg-gray-100\b', 'bg-yellow-100'
    $text = $text -replace 'bg-gray-200\b', 'bg-yellow-200'
    $text = $text -replace 'bg-gray-300\b', 'bg-yellow-300'
    $text = $text -replace 'bg-gray-400\b', 'bg-yellow-400'
    $text = $text -replace 'bg-gray-700\b', 'bg-neutral-700'
    $text = $text -replace 'bg-gray-800\b', 'bg-neutral-800'
    $text = $text -replace 'bg-gray-900\b', 'bg-neutral-900'
    $text = $text -replace 'text-gray-900\b', 'text-neutral-900'
    $text = $text -replace 'text-gray-800\b', 'text-neutral-800'
    $text = $text -replace 'text-gray-700\b', 'text-neutral-700'
    $text = $text -replace 'text-gray-600\b', 'text-neutral-600'
    $text = $text -replace 'text-gray-500\b', 'text-neutral-500'
    $text = $text -replace 'text-gray-400\b', 'text-neutral-400'
    $text = $text -replace 'border-gray-100\b', 'border-yellow-100'
    $text = $text -replace 'border-gray-200\b', 'border-yellow-200'
    $text = $text -replace 'border-gray-300\b', 'border-yellow-300'
    $text = $text -replace 'divide-gray-200\b', 'divide-yellow-200'
    $text = $text -replace 'ring-gray-', 'ring-yellow-'
    # focus:ring-black / focus:border-black (focus rings)
    $text = $text -replace 'focus:ring-black\b', 'focus:ring-yellow-400'
    $text = $text -replace 'focus:border-black\b', 'focus:border-yellow-400'
    if ($text -ne $orig) {
        Set-Content -Path $f.FullName -Value $text -NoNewline
        $totalChanged++
        Write-Host "Updated: $($f.FullName.Replace($Root, ''))"
    }
}
Write-Host "`nTotal files changed: $totalChanged"
