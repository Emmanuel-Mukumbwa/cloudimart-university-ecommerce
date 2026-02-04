//src/app/(auth)/register/page.tsx
'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const registerSchema = z.object({
  name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password too short'),
  password_confirmation: z.string().min(6, 'Confirm your password'),
  phone_number: z.string().optional(),
  location_id: z.string().nonempty('Select your location'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [gpsStatus, setGpsStatus] = useState<string>('');
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const API = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    const url = API ? `${API}/api/locations` : '/api/locations';
    axios.get(url)
      .then(res => setLocations(res.data.data || res.data.locations || []))
      .catch(console.error);
  }, [API]);

  // --- GPS + Backend Validation Function ---
  const confirmLocationWithGPS = async (selectedLocationId?: number) => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation not supported on this device');
      return { ok: false, reason: 'no_gps' };
    }

    setVerifying(true);
    setGpsStatus('Getting GPS coordinates...');

    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 })
      );
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setCoords({ lat, lng });
      setGpsStatus('Verifying location...');

      const res = await axios.post('/api/locations/validate', { lat, lng, location_id: selectedLocationId });
      setVerificationResult(res.data);
      setGpsStatus('');

      return res.data; // { inside_any_area, matches_selected }
    } catch (e: any) {
      setGpsStatus('GPS failed or denied');
      return { ok: false, reason: e?.message ?? 'gps_failed' };
    } finally {
      setVerifying(false);
    }
  };

  // --- Form Submit Handler ---
  const onSubmit = async (data: RegisterFormData) => {
    const selectedId = parseInt(data.location_id);
    const gpsResult = await confirmLocationWithGPS(selectedId);

    // If GPS validation successful
    if (gpsResult?.matches_selected) {
      setGpsStatus('Location verified ✔ Proceeding...');
      await handleRegister(data, coords.lat, coords.lng, 'accept');
    } 
    else if (gpsResult?.inside_any_area && !gpsResult.matches_selected) {
      const confirmUpdate = confirm(
        `Your GPS shows you're inside another registered area (${
          gpsResult?.detected_location?.name || 'different area'
        }).\n\nPress OK to update your location or Cancel to keep your selected one (unverified).`
      );
      if (confirmUpdate) {
        await handleRegister(data, coords.lat, coords.lng, 'update');
      } else {
        await handleRegister(data, coords.lat, coords.lng, 'force');
      }
    } 
    else if (gpsResult?.inside_any_area === false) {
      const proceedAnyway = confirm(
        'You appear to be outside the supported community area.\nContinue registration (unverified)?'
      );
      if (proceedAnyway) {
        await handleRegister(data, coords.lat, coords.lng, 'force');
      }
    } 
    else {
      alert('Could not verify your location. Try again or register manually.');
    }
  };

  // --- Register Request ---
  const handleRegister = async (
    data: RegisterFormData,
    lat?: number,
    lng?: number,
    action: 'accept' | 'update' | 'force' = 'accept'
  ) => {
    try {
      const url = API ? `${API}/api/auth/register` : '/api/auth/register';
      const payload = {
        ...data,
        latitude: lat,
        longitude: lng,
        postVerificationAction: action,
      };

      const res = await axios.post(url, payload);
      alert(`Registration successful! ${res.data.verified ? 'Location verified.' : 'Location pending verification.'}`);
      localStorage.setItem('auth_token', res.data.access_token);
      window.location.href = '/';
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
                {/* Name */}
                <div className="mb-3">
                  <input {...register('name')} placeholder="Full Name" className="form-control" />
                  {errors.name && <small className="text-danger">{errors.name.message}</small>}
                </div>

                {/* Email */}
                <div className="mb-3">
                  <input {...register('email')} placeholder="Email" type="email" className="form-control" />
                  {errors.email && <small className="text-danger">{errors.email.message}</small>}
                </div>

                {/* Passwords */}
                <div className="mb-3">
                  <input {...register('password')} placeholder="Password" type="password" className="form-control" />
                  {errors.password && <small className="text-danger">{errors.password.message}</small>}
                </div>
                <div className="mb-3">
                  <input {...register('password_confirmation')} placeholder="Confirm Password" type="password" className="form-control" />
                  {errors.password_confirmation && <small className="text-danger">{errors.password_confirmation.message}</small>}
                </div>

                {/* Phone */}
                <div className="mb-3">
                  <input {...register('phone_number')} placeholder="Phone Number" className="form-control" />
                </div>

                {/* Location Dropdown */}
                <div className="mb-4">
                  <select {...register('location_id')} className="form-select">
                    <option value="">Select your location</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                  {errors.location_id && <small className="text-danger">{errors.location_id.message}</small>}
                </div>

                {/* Status */}
                {gpsStatus && <div className="alert alert-info py-2 small text-center">{gpsStatus}</div>}

                {/* Submit */}
                <button type="submit" className="btn btn-primary w-100" disabled={verifying}>
                  {verifying ? 'Verifying location...' : 'Register'}
                </button>
              </form>

              {/* Info */}
              <p className="mt-3 text-muted small text-center">
                We’ll confirm your GPS to verify you’re within the Mzuzu University community areas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
