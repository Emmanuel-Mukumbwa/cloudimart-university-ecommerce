<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Http\Resources\ProductResource;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $q = $request->query('q');
        $category = $request->query('category'); // slug or id
        $pageSize = (int) $request->query('per_page', 12);

        $query = Product::with('category')->orderBy('created_at', 'desc');

        if ($category) {
            // allow slug or id
            if (is_numeric($category)) {
                $query->where('category_id', (int)$category);
            } else {
                $query->whereHas('category', fn($qcat)=> $qcat->where('slug', $category));
            }
        }

        if ($q) {
            $query->where(function($s) use ($q) {
                $s->where('name', 'like', "%{$q}%")
                  ->orWhere('description', 'like', "%{$q}%");
            });
        }

        $products = $query->paginate($pageSize)->withQueryString();

        return ProductResource::collection($products)
            ->additional([
                'meta' => [
                    'current_page' => $products->currentPage(),
                    'last_page' => $products->lastPage(),
                    'per_page' => $products->perPage(),
                    'total' => $products->total(),
                ]
            ]);
    }

    public function show($id)
    {
        $product = Product::with('category')->findOrFail($id);
        return new ProductResource($product);
    }
}
