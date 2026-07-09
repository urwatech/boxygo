<?php

namespace Tests\Feature\Api\V1\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_with_email(): void
    {
        $password = 'Password123!';

        $user = User::factory()->create([
            'email' => 'driver@example.com',
            'password' => $password,
            'status' => 'active',
            'phone_number' => '+12345678901',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'driver@example.com',
            'password' => $password,
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'Login successful.')
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.token.token_type', 'Bearer');
    }

    public function test_user_can_login_with_phone_number(): void
    {
        $password = 'Password123!';

        $user = User::factory()->create([
            'email' => 'courier@example.com',
            'password' => $password,
            'status' => 'active',
            'phone_number' => '+19876543210',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'phone_number' => '+1 (987) 654-3210',
            'password' => $password,
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'Login successful.')
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.token.token_type', 'Bearer');
    }
}
