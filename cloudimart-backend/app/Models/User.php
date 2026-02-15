<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone_number',
        'location_id',
        'latitude',
        'longitude',
        'role',
        'is_active',
        // 'delivery_verified_at', 'delivery_verified_meta' if you want to mass assign them elsewhere
    ];

    /**
     * The attributes that should be hidden for arrays.
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'location_verified_at' => 'datetime',
        'delivery_verified_at' => 'datetime',
        'delivery_verified_meta' => 'array',
    ];

    /**
     * Relationship: User belongs to a Location.
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /**
     * Relationship: deliveries assigned to this user (as delivery person).
     */
    public function deliveriesAssigned(): HasMany
    {
        return $this->hasMany(Delivery::class, 'delivery_person_id');
    }

    /**
     * Role helpers.
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isDelivery(): bool
    {
        return $this->role === 'delivery';
    }

    public function isUser(): bool
    {
        return $this->role === 'user';
    }

    /**
     * Scope: returns only active users with role 'delivery'.
     *
     * Usage: User::deliveryPeople()->get();
     */
    public function scopeDeliveryPeople(Builder $query): Builder
    {
        return $query->where('role', 'delivery')->where('is_active', 1);
    }
}

 