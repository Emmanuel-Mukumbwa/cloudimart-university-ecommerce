// src/app/(auth)/register/page.tsx
'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import CenteredModal from '../../../components/common/CenteredModal';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

const registerSchema = z.object({
  name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  password_confirmation: z.string().min(6, 'Please confirm your password'),
  phone_number: z.string().optional(),
  location_id: z.string().nonempty('Please select your location'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

// Silent hardcoded fallback coords (Chitipa) used only when navigator.geolocation fails.
// Kept for local testing convenience — remove before production if you don't want silent fallbacks.
const FALLBACK_COORDS = { lat: -9.696192, lng: 33.28139 };

export default function RegisterPage() {
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [gpsStatus, setGpsStatus] = useState<string>('');
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, setError, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  // Modal state (use CenteredModal instead of alert)
  const [modal, setModal] = useState<{ show: boolean; title?: string; body?: React.ReactNode; ok?: () => void }>({
    show: false,
    title: undefined,
    body: undefined,
  });

  const API = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    const url = API ? `${API}/api/locations` : '/api/locations';
    axios.get(url)
      .then(res => setLocations(res.data.data || res.data.locations || []))
      .catch((e) => {
        console.error('Failed to load locations', e);
        setLocations([]);
      });
  }, [API]);

  // --- GPS + Backend Validation Function ---
  const confirmLocationWithGPS = async (selectedLocationId?: number) => {
    const url = API ? `${API}/api/locations/validate-public` : '/api/locations/validate-public';

    // helper to call server validate endpoint
    const callValidate = async (lat: number, lng: number) => {
      try {
        const res = await axios.post(url, { lat, lng, location_id: selectedLocationId });
        setVerificationResult(res.data);
        return res.data;
      } catch (err: any) {
        console.error('[register] validate-public error', err?.response ?? err);
        throw err;
      }
    };

    setVerifying(true);
    setGpsStatus('Getting GPS coordinates...');

    // try native geolocation, fall back silently to hardcoded coords (for dev)
    try {
      if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 })
        );
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setGpsStatus('Verifying coordinates...');

        const serverRes = await callValidate(lat, lng);
        setGpsStatus('');
        return serverRes;
      } else {
        // no geolocation available (older browsers) — use fallback silently
        console.warn('[register] navigator.geolocation not available, using fallback coords');
        setCoords(FALLBACK_COORDS);
        setGpsStatus('Verifying coordinates...');
        const serverRes = await callValidate(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng);
        setGpsStatus('');
        return serverRes;
      }
    } catch (e: any) {
      // if geolocation fails, attempt fallback coords silently
      console.warn('[register] geolocation failed — attempting fallback validation', e?.message ?? e);
      try {
        setCoords(FALLBACK_COORDS);
        setGpsStatus('Verifying coordinates...');
        const serverRes = await callValidate(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng);
        setGpsStatus('');
        return serverRes;
      } catch (err) {
        // If server validation fails (network/CORS), return null to let caller decide.
        console.error('[register] validate-public failed for fallback coords', err?.response ?? err);
        setGpsStatus('');
        return null;
      } finally {
        setVerifying(false);
      }
    } finally {
      setVerifying(false);
    }
  };

  // --- Form Submit Handler ---
  const onSubmit = async (data: RegisterFormData) => {
    // clear previous server field errors
    // (we don't have all field keys; react-hook-form setError used below if server returns validation errors)
    try {
      const selectedId = parseInt(data.location_id);
      const gpsResult = await confirmLocationWithGPS(selectedId);

      // If gpsResult is null (server validation failed), allow registration but mark unverified
      if (gpsResult === null) {
        // Continue registration but do not claim verified
        await submitRegistration(data, coords.lat, coords.lng, 'force');
        return;
      }

      if (gpsResult?.matches_selected) {
        // verified in selected area
        await submitRegistration(data, coords.lat, coords.lng, 'accept');
        return;
      }

      if (gpsResult?.inside_any_area && !gpsResult.matches_selected) {
        // offer user choice via modal (update location / keep / force)
        setModal({
          show: true,
          title: 'Location differs',
          body: (
            <div>
              <p className="small mb-2">
                Our check detected you're inside another registered area: <strong>{gpsResult?.detected_location?.name ?? 'Other area'}</strong>.
              </p>
              <p className="small mb-0">Choose whether to update your selected location or continue with your selection (unverified).</p>
            </div>
          ),
          ok: async () => {
            // OK = update to detected (update action)
            setModal((m) => ({ ...m, show: false }));
            await submitRegistration(data, coords.lat, coords.lng, 'update');
          },
        });

        // replace default modal buttons: we want two choices. We'll show a modal with confirm and cancel handlers below.
        // To keep things simple, we open a second modal with actions:
        setModal({
          show: true,
          title: 'Location detected',
          body: (
            <div>
              <p className="mb-2 small">
                Your coordinates match <strong>{gpsResult?.detected_location?.name ?? 'another area'}</strong>.
              </p>
              <div className="d-flex gap-2 justify-content-end">
                <button className="btn btn-outline-secondary" onClick={async () => { setModal({ show: false }); await submitRegistration(data, coords.lat, coords.lng, 'force'); }}>
                  Keep selected (unverified)
                </button>
                <button className="btn btn-primary" onClick={async () => { setModal({ show: false }); await submitRegistration(data, coords.lat, coords.lng, 'update'); }}>
                  Update to detected area
                </button>
              </div>
            </div>
          ),
        });

        return;
      }

      if (gpsResult?.inside_any_area === false) {
        // outside any area — ask user if they want to proceed unverified
        setModal({
          show: true,
          title: 'Outside supported area',
          body: (
            <div>
              <p className="small mb-2">Your location appears to be outside supported community areas.</p>
              <div className="d-flex gap-2 justify-content-end">
                <button className="btn btn-outline-secondary" onClick={() => setModal({ show: false })}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={async () => { setModal({ show: false }); await submitRegistration(data, coords.lat, coords.lng, 'force'); }}>
                  Continue (unverified)
                </button>
              </div>
            </div>
          ),
        });
        return;
      }

      // fallback
      if (!gpsResult) {
        // could not verify
        setModal({ show: true, title: 'Location verification', body: 'Could not verify your location. You can continue registering but your location will be unverified.' });
        await submitRegistration(data, coords.lat, coords.lng, 'force');
      }
    } catch (e) {
      console.error('onSubmit error', e);
      setModal({ show: true, title: 'Error', body: 'An unexpected error occurred. Please try again.' });
    }
  };

  // --- Register Request (submits to server) ---
  const submitRegistration = async (
    data: RegisterFormData,
    lat?: number,
    lng?: number,
    action: 'accept' | 'update' | 'force' = 'accept'
  ) => {
    setSubmitting(true);
    setGpsStatus('');
    try {
      const url = API ? `${API}/api/auth/register` : '/api/auth/register';
      const payload = {
        ...data,
        latitude: lat,
        longitude: lng,
        postVerificationAction: action,
      };

      const res = await axios.post(url, payload);

      // expect backend to return token in res.data.token or res.data.access_token
      const token = res.data?.access_token ?? res.data?.token ?? null;
      if (token) {
        localStorage.setItem('auth_token', token);
      }

      setModal({
        show: true,
        title: 'Registration successful',
        body: `Welcome ${res.data?.user?.name ?? 'user'}! Your account was created.`,
        ok: () => {
          setModal((m) => ({ ...m, show: false }));
          window.location.href = res.data?.redirect_url ?? '/';
        },
      });
    } catch (err: any) {
      console.error('Registration failed', err?.response ?? err);

      // Map server validation errors (Laravel style: errors: { field: [msg] })
      const resp = err?.response?.data ?? null;
      if (resp) {
        if (resp.errors && typeof resp.errors === 'object') {
          Object.keys(resp.errors).forEach((field) => {
            const msg = Array.isArray(resp.errors[field]) ? resp.errors[field][0] : String(resp.errors[field]);
            // try to map to RHF fields
            try {
              setError(field as any, { type: 'server', message: msg });
            } catch { /* ignore invalid field names */ }
          });
          // show top-level message as modal as well
          setModal({ show: true, title: 'Registration failed', body: Object.values(resp.errors).flat().join(' — ') });
        } else if (resp.message) {
          setModal({ show: true, title: 'Registration failed', body: resp.message });
        } else {
          setModal({ show: true, title: 'Registration failed', body: JSON.stringify(resp).slice(0, 400) });
        }
      } else {
        setModal({ show: true, title: 'Registration failed', body: err?.message ?? 'Unknown error' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-5">
      <CenteredModal
        show={modal.show}
        title={modal.title}
        body={modal.body}
        onClose={() => { if (modal.ok) modal.ok(); else setModal((m) => ({ ...m, show: false })); }}
        onCancel={() => setModal((m) => ({ ...m, show: false }))}
        okLabel="OK"
        cancelLabel="Close"
      />

      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h3 className="mb-4 text-center">Create an Account</h3>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                {/* Name */}
                <div className="mb-3">
                  <input {...register('name')} placeholder="Full Name" className={`form-control ${errors.name ? 'is-invalid' : ''}`} />
                  {errors.name && <div className="invalid-feedback">{errors.name.message}</div>}
                </div>

                {/* Email */}
                <div className="mb-3">
                  <input {...register('email')} placeholder="Email" type="email" className={`form-control ${errors.email ? 'is-invalid' : ''}`} />
                  {errors.email && <div className="invalid-feedback">{errors.email.message}</div>}
                </div>

                {/* Passwords */}
                <div className="mb-3">
                  <input {...register('password')} placeholder="Password" type="password" className={`form-control ${errors.password ? 'is-invalid' : ''}`} />
                  {errors.password && <div className="invalid-feedback">{errors.password.message}</div>}
                </div>
                <div className="mb-3">
                  <input {...register('password_confirmation')} placeholder="Confirm Password" type="password" className={`form-control ${errors.password_confirmation ? 'is-invalid' : ''}`} />
                  {errors.password_confirmation && <div className="invalid-feedback">{errors.password_confirmation.message}</div>}
                </div>

                {/* Phone */}
                <div className="mb-3">
                  <input {...register('phone_number')} placeholder="Phone Number" className="form-control" />
                </div>

                {/* Location Dropdown */}
                <div className="mb-4">
                  <select {...register('location_id')} className={`form-select ${errors.location_id ? 'is-invalid' : ''}`}>
                    <option value="">Select your location</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                  {errors.location_id && <div className="invalid-feedback">{errors.location_id.message}</div>}
                </div>

                {/* Status */}
                {gpsStatus && <div className="alert alert-info py-2 small text-center">{gpsStatus}</div>}

                {/* Submit - show spinner when submitting */}
                <button type="submit" className="btn btn-primary w-100" disabled={verifying || submitting}>
                  {submitting ? <LoadingSpinner /> : (verifying ? 'Verifying coordinates...' : 'Register')}
                </button>
              </form>

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
