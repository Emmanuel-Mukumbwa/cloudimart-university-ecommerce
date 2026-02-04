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
      .catch(console.error);
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
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h3 className="mb-4 text-center">Create an Account</h3>
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="mb-3">
                  <input {...register('name')} placeholder="Full Name" className="form-control" />
                  {errors.name && <small className="text-danger">{errors.name.message}</small>}
                </div>

                <div className="mb-3">
                  <input {...register('email')} placeholder="Email" type="email" className="form-control" />
                  {errors.email && <small className="text-danger">{errors.email.message}</small>}
                </div>

                <div className="mb-3">
                  <input {...register('password')} placeholder="Password" type="password" className="form-control" />
                  {errors.password && <small className="text-danger">{errors.password.message}</small>}
                </div>

                <div className="mb-3">
                  <input {...register('password_confirmation')} placeholder="Confirm Password" type="password" className="form-control" />
                  {errors.password_confirmation && <small className="text-danger">{errors.password_confirmation.message}</small>}
                </div>

                <div className="mb-3">
                  <input {...register('phone_number')} placeholder="Phone Number" className="form-control" />
                </div>

                <div className="mb-4">
                  <select {...register('location_id')} className="form-select">
                    <option value="">Select your location</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                  {errors.location_id && <small className="text-danger">{errors.location_id.message}</small>}
                </div>

                <button type="submit" className="btn btn-primary w-100">
                  Register
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
