<?php

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

if (!function_exists('upload_path')) {
    /**
     * @param  string  $module  Primary folder inside the assets directory (e.g. "admin-settings").
     * @param  string  $subDirectory  Optional nested folder within the module (e.g. "avatars").
     * @return array{relative: string, absolute: string} Relative and absolute paths to the upload directory.
     */
    function upload_path(string $module, string $subDirectory = ''): array
    {
        $module = trim($module, '/');
        $subDirectory = trim($subDirectory, '/');

        if ($module === '') {
            throw new \InvalidArgumentException('Module name for upload path cannot be empty.');
        }

        $relativeSegments = array_filter(['assets', $module, $subDirectory], static function ($segment) {
            return $segment !== '';
        });

        $relativePath = implode('/', $relativeSegments);
        $absolutePath = public_path($relativePath);

        if (!is_dir($absolutePath)) {
            mkdir($absolutePath, 0755, true);
        }

        return [
            'relative' => $relativePath,
            'absolute' => $absolutePath,
        ];
    }
}

if (!function_exists('media_url')) {
    /**
     * Consistently convert a stored media path (storage disk, public assets, or absolute URL) into a browser-safe URL.
     */
    function media_url(?string $path): ?string
    {
        if ($path === null || $path === '') {
            return null;
        }

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            return $path;
        }

        $normalized = ltrim($path, '/');

        if ($normalized === '') {
            return null;
        }

        if (str_starts_with($normalized, 'assets/')) {
            return asset($normalized);
        }

        if (str_starts_with($normalized, 'storage/')) {
            if (str_starts_with($normalized, 'storage/app/public/')) {
                $normalized = substr($normalized, strlen('storage/app/public/'));
                return asset('storage/' . $normalized);
            }
            return asset($normalized);
        }

        if (str_starts_with($normalized, 'public/')) {
            $normalized = substr($normalized, strlen('public/'));
        }

        return Storage::disk('public')->url($normalized);
    }
}

if (!function_exists('store_public_upload')) {
    /**
     * Move an uploaded file into the public/assets directory tree for direct serving.
     */
    function store_public_upload(UploadedFile $file, string $module, string $subDirectory = '', ?string $fileName = null): string
    {
        ['relative' => $relativeDir, 'absolute' => $absoluteDir] = upload_path($module, $subDirectory);

        $extension = $file->getClientOriginalExtension() ?: $file->extension() ?: 'bin';

        if ($fileName === null) {
            $fileName = uniqid('upload_', true) . '.' . $extension;
        } elseif (!str_contains($fileName, '.')) {
            $fileName .= '.' . $extension;
        }

        $file->move($absoluteDir, $fileName);

        return trim($relativeDir . '/' . $fileName, '/');
    }
}

if (!function_exists('delete_media_file')) {
    /**
     * Remove a media file regardless of whether it was stored in public/assets or storage/app/public.
     */
    function delete_media_file(?string $path): void
    {
        if ($path === null || $path === '' || filter_var($path, FILTER_VALIDATE_URL)) {
            return;
        }

        $normalized = ltrim($path, '/');

        if ($normalized === '') {
            return;
        }

        $storageRelative = $normalized;

        if (str_starts_with($storageRelative, 'storage/')) {
            $storageRelative = substr($storageRelative, strlen('storage/'));
        }

        if (str_starts_with($storageRelative, 'app/public/')) {
            $storageRelative = substr($storageRelative, strlen('app/public/'));
        }

        if (str_starts_with($storageRelative, 'public/')) {
            $storageRelative = substr($storageRelative, strlen('public/'));
        }

        if ($storageRelative !== '' && Storage::disk('public')->exists($storageRelative)) {
            Storage::disk('public')->delete($storageRelative);
        }

        $publicPath = public_path($normalized);
        if (!File::exists($publicPath)) {
            $publicPath = public_path($storageRelative);
        }

        if ($publicPath && File::exists($publicPath)) {
            File::delete($publicPath);
        }
    }
}
