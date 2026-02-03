<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    // Mass assignable
    protected $fillable = [
        'name',
        'description',
        'price',
        'category_id',
        'image_url',
        'stock',
    ];

    // Type casting
    protected $casts = [
        'price' => 'decimal:2',
        'stock' => 'integer',
    ];

    /**
     * Category relationship
     */
    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * Order items (if you create order_items)
     */
    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * Cart items (if you create cart_items)
     */
    public function cartItems()
    {
        return $this->hasMany(CartItem::class);
    }

    /**
     * Scope: simple search by name/description
     */
    public function scopeSearch($query, ?string $q)
    {
        if (!$q) return $query;
        return $query->where(function ($qbuilder) use ($q) {
            $qbuilder->where('name', 'like', "%{$q}%")
                     ->orWhere('description', 'like', "%{$q}%");
        });
    }

    /**
     * Scope: filter by category id or slug
     */
    public function scopeByCategory($query, $category)
    {
        if (!$category) return $query;

        if (is_numeric($category)) {
            return $query->where('category_id', (int) $category);
        }

        return $query->whereHas('category', function ($q) use ($category) {
            $q->where('slug', $category);
        });
    }
}
