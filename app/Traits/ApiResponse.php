<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;

/**
 * Provides common JSON API responses.
 */
trait ApiResponse
{
    /**
     * Successful JSON response wrapper.
     */
    protected function success(mixed $data = null, int $code = 200): JsonResponse
    {
        return response()->json(['data' => $data], $code);
    }

    /**
     * Error JSON response wrapper.
     */
    protected function error(string $message, int $code = 400): JsonResponse
    {
        return response()->json(['error' => $message], $code);
    }
}
