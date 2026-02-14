<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SiteTerm extends Model
{
    use HasFactory;

    protected $table = 'site_terms';

    protected $fillable = [
        'slug',
        'title',
        'content',
        'version',
        'last_edited_by',
    ];

    // if you want to cast content to string explicitly
    protected $casts = [
        'version' => 'integer',
    ];

    public static function latestTerm()
    {
        return self::orderByDesc('version')->first();
    }
}
