<?php

namespace Tests\Feature\Customer\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerRegisterTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_registration_requires_unique_phone_number(): void
    {
        User::factory()->create([
            'name' => 'Existing Customer',
            'email' => 'existing@example.com',
            'phone_number' => '+963 551234567',
        ]);

        $response = $this->from(route('customer.register'))
            ->post(route('customer.register.store'), [
                'first_name' => 'John',
                'last_name' => 'Doe',
                'email' => 'john@example.com',
                'phone_code' => '+963',
                'phone_number' => '551234567',
                'password' => 'Password1!',
                'password_confirmation' => 'Password1!',
                'terms' => 'on',
            ]);

        $response
            ->assertRedirect(route('customer.register'))
            ->assertSessionHasErrors('phone_number');
    }

    public function test_customer_registration_requires_unique_email(): void
    {
        User::factory()->create([
            'name' => 'Existing Customer',
            'email' => 'john@example.com',
        ]);

        $response = $this->from(route('customer.register'))
            ->post(route('customer.register.store'), [
                'first_name' => 'John',
                'last_name' => 'Doe',
                'email' => 'john@example.com',
                'phone_code' => '+963',
                'phone_number' => '551234567',
                'password' => 'Password1!',
                'password_confirmation' => 'Password1!',
                'terms' => 'on',
            ]);

        $response
            ->assertRedirect(route('customer.register'))
            ->assertSessionHasErrors('email');
    }
}
