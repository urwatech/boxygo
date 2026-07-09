<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UploadController extends Controller
{
    /**
     * Store a single photo for a booking and return its public URL.
     */
    public function storePhoto(Request $request): JsonResponse
    {
        $request->validate([
            'photo' => 'required|image|max:5120', // 5MB
        ]);

        $file = $request->file('photo');

        // Use helper to resolve upload directories
        $paths = upload_path('customer-uploads', 'parcel-photos');

        $extension = $file->getClientOriginalExtension() ?: 'jpg';
        $filename = uniqid('photo_', true).'.'.$extension;
        $file->move($paths['absolute'], $filename);

        $relative = $paths['relative'].'/'.$filename;
        $url = asset($relative);

        return response()->json([
            'url' => $url,
            'relative' => $relative,
            'filename' => $filename,
        ]);
    }

    /**
     * Store a single document for a booking and return its public URL.
     */
    public function storeDocument(Request $request): JsonResponse
    {
        $request->validate([
            'document' => 'required|file|max:10240|mimes:pdf,doc,docx,xls,xlsx,txt,jpg,jpeg,png', // 10MB
        ]);

        $file = $request->file('document');

        // Use helper to resolve upload directories
        $paths = upload_path('customer-uploads', 'parcel-docs');

        $extension = $file->getClientOriginalExtension() ?: 'pdf';
        $filename = uniqid('doc_', true).'.'.$extension;
        $file->move($paths['absolute'], $filename);

        $relative = $paths['relative'].'/'.$filename;
        $url = asset($relative);

        return response()->json([
            'url' => $url,
            'relative' => $relative,
            'filename' => $filename,
        ]);
    }
}
