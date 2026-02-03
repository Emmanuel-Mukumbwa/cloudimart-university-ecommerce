<?php
namespace App\Http\Resources;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'name'=> $this->name,
            'description'=> $this->description,
            'price'=> (float) $this->price,
            'category' => [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'type' => $this->category->type,
            ],
            'image_url' => $this->image_url,
            'stock' => (int) $this->stock,
        ];
    }
}
