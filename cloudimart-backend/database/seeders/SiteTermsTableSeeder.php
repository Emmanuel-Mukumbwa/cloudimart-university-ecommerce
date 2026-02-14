<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\SiteTerm;

class SiteTermsTableSeeder extends Seeder
{
    public function run()
    {
        $defaultContent = <<<'TXT'
<h2>Cloudimart Terms & Conditions (Prototype)</h2>
<p>Welcome to Cloudimart — this is a prototype for Mzuzu University community deliveries. By placing an order you accept these terms.</p>
<h3>1. Scope</h3>
<p>These Terms govern purchases of goods through our platform. Delivery is restricted to configured Mzuzu-area locations.</p>
<h3>2. Orders and Payment</h3>
<p>Orders are confirmed after successful payment. We generate an Order ID which will be used to receive deliveries.</p>
<h3>3. Delivery</h3>
<p>Delivery will be completed to addresses within configured service area only. On delivery the customer must present Order ID and phone number.</p>
<h3>4. Liability</h3>
<p>This prototype is provided "as-is" for demonstration; liability is limited to the paid purchase amount.</p>
<h3>5. Contact</h3>
<p>Support: support@cloudimart.example (placeholder)</p>
TXT;

        SiteTerm::create([
            'slug' => 'terms-v1',
            'title' => 'Cloudimart Terms & Conditions (v1)',
            'content' => $defaultContent,
            'version' => 1,
            'last_edited_by' => null,
        ]);
    }
}
