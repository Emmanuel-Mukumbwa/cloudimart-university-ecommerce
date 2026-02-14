<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\SiteTerm;
use Illuminate\Support\Str;

class SiteTermsController extends Controller
{
    // Public: get latest terms
    public function publicLatest()
    {
        $term = SiteTerm::latestTerm();
        if (!$term) {
            return response()->json(['message' => 'No terms available'], 404);
        }
        return response()->json(['term' => $term], 200);
    }

    // Admin: list terms (history)
    public function index()
    {
        $terms = SiteTerm::orderByDesc('version')->get();
        return response()->json(['terms' => $terms], 200);
    }

    // Admin: create new version
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
        ]);

        $latest = SiteTerm::latestTerm();
        $nextVersion = $latest ? ($latest->version + 1) : 1;
        $slug = $request->input('slug') ?? 'terms-v' . $nextVersion;

        $term = SiteTerm::create([
            'slug' => $slug,
            'title' => $validated['title'],
            'content' => $validated['content'],
            'version' => $nextVersion,
            'last_edited_by' => auth()->id() ?? null,
        ]);

        return response()->json(['term' => $term], 201);
    }

    // Admin: update existing (edit)
    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
        ]);

        $term = SiteTerm::findOrFail($id);
        $term->title = $validated['title'];
        $term->content = $validated['content'];
        $term->last_edited_by = auth()->id() ?? $term->last_edited_by;
        $term->save();

        return response()->json(['term' => $term], 200);
    }
}
