<?php

namespace App\Http;

use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Centralized API response handler for consistent JSON responses.
 */
class ApiResponse
{
    /**
     * Return a success response.
     *
     * @param  mixed  $data
     */
    public static function success($data = null, ?string $message = null, int $statusCode = Response::HTTP_OK): JsonResponse
    {
        if ($message) {
            $message = __($message);
        }

        $response = [
            'success' => true,
        ];

        if ($message) {
            $response['message'] = $message;
        }

        if ($data !== null) {
            $response['data'] = $data;
        }

        return response()->json($response, $statusCode);
    }

    /**
     * Return a created response (201).
     *
     * @param  mixed  $data
     */
    public static function created($data = null, ?string $message = 'Resource created successfully.'): JsonResponse
    {
        return self::success($data, $message, Response::HTTP_CREATED);
    }

    /**
     * Return a no content response (204).
     */
    public static function noContent(): JsonResponse
    {
        return response()->json([
            'success' => true,
        ], Response::HTTP_NO_CONTENT);
    }

    /**
     * Return an error response.
     */
    public static function error(string $message, int $statusCode = Response::HTTP_BAD_REQUEST): JsonResponse
    {
        $message = __($message);

        return response()->json([
            'success' => false,
            'message' => $message,
        ], $statusCode);
    }

    /**
     * Return a not found response (404).
     */
    public static function notFound(string $message = 'Resource not found.'): JsonResponse
    {
        return self::error($message, Response::HTTP_NOT_FOUND);
    }

    /**
     * Return a validation error response (422).
     */
    public static function validationError(array $errors, ?string $message = 'The given data was invalid.'): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message ? __($message) : null,
            'errors' => $errors,
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }

    /**
     * Return a bad request response (400).
     */
    public static function badRequest(string $message): JsonResponse
    {
        return self::error($message, Response::HTTP_BAD_REQUEST);
    }

    /**
     * Return an unauthorized response (401).
     */
    public static function unauthorized(string $message = 'Unauthenticated.'): JsonResponse
    {
        return self::error($message, Response::HTTP_UNAUTHORIZED);
    }

    /**
     * Return a forbidden response (403).
     */
    public static function forbidden(string $message = 'This action is unauthorized.'): JsonResponse
    {
        return self::error($message, Response::HTTP_FORBIDDEN);
    }

    /**
     * Return a server error response (500).
     */
    public static function serverError(string $message = 'Internal server error.'): JsonResponse
    {
        return self::error($message, Response::HTTP_INTERNAL_SERVER_ERROR);
    }
}
