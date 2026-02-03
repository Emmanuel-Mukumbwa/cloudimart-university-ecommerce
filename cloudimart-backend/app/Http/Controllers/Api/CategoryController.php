<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $cats = Category::orderBy('name')->get(['id','name','slug','type']);
        return response()->json(['success' => true, 'data' => $cats]);
    }
}
