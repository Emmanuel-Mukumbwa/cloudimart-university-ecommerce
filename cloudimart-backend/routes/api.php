use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LocationController;

Route::get('/locations', [LocationController::class, 'index']); // for dropdown

Route::post('/auth/register', [AuthController::class, 'register']); // user registration
Route::post('/auth/login', [AuthController::class, 'login']);       // login
