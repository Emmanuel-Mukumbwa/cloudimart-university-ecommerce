//src/app/(auth)/register/page.tsx
'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  password_confirmation: z.string().min(6),
  phone_number: z.string().optional(),
  location_id: z.string().nonempty()
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema)
  });

  const API = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    const url = API ? `${API}/api/locations` : '/api/locations';
    axios.get(url)
      .then(res => setLocations(res.data.locations || []))
      .catch(err => {
        console.error('Failed to load locations:', err);
      });
  }, [API]);

  const onSubmit = async (data: RegisterFormData) => {
    try {
      const url = API ? `${API}/api/auth/register` : '/api/auth/register';
      const res = await axios.post(url, data);
      alert(`Registered successfully! Token: ${res.data.access_token}`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Register</h2>

        <input {...register('name')} placeholder="Full Name" className="w-full p-2 border rounded mb-2" />
        {errors.name && <p className="text-red-600 text-sm">{errors.name.message}</p>}

        <input {...register('email')} placeholder="Email" type="email" className="w-full p-2 border rounded mb-2" />
        {errors.email && <p className="text-red-600 text-sm">{errors.email.message}</p>}

        <input {...register('password')} placeholder="Password" type="password" className="w-full p-2 border rounded mb-2" />
        {errors.password && <p className="text-red-600 text-sm">{errors.password.message}</p>}

        <input {...register('password_confirmation')} placeholder="Confirm Password" type="password" className="w-full p-2 border rounded mb-2" />
        {errors.password_confirmation && <p className="text-red-600 text-sm">{errors.password_confirmation.message}</p>}

        <input {...register('phone_number')} placeholder="Phone Number" className="w-full p-2 border rounded mb-2" />
        {errors.phone_number && <p className="text-red-600 text-sm">{errors.phone_number.message}</p>}

        <select {...register('location_id')} className="w-full p-2 border rounded mb-3">
          <option value="">Select your location</option>
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
        {errors.location_id && <p className="text-red-600 text-sm">{errors.location_id.message}</p>}

        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
          Register
        </button>
      </form>
    </div>
  );
}
