'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import CenteredModal from '../../../components/common/CenteredModal';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

const registerSchema = z.object({
  first_name: z.string().min(2, 'First name is required'),
  last_name: z.string().min(2, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  password_confirmation: z.string().min(6, 'Please confirm your password'),
  phone_number: z.string().optional(),
  location_id: z.string().nonempty('Please select your location'),
}).superRefine((val, ctx) => {
  if (val.password !== val.password_confirmation) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Passwords do not match',
      path: ['password_confirmation'],
    });
  }
});

type RegisterFormData = z.infer<typeof registerSchema>;

// Silent hardcoded fallback coords (Chitipa) used only when navigator.geolocation fails.
// Kept for local testing convenience — remove before production if you don't want silent fallbacks.
const FALLBACK_COORDS = { lat: -9.696192, lng: 33.28139 };
const FALLBACK_LOCATION_NAME = 'chitipa'; // case-insensitive compare against location name

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
  const [modal, setModal] = useState<{ show: boolean; title?: string; body?: React.ReactNode; ok?: () => void }>( {
    show: false,
    title: undefined,
    body: undefined,
  });

  // show/hide password toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  // helper: find location name by id
  const getLocationName = (id?: number) => {
    if (!id) return '';
    const found = locations.find(l => l.id === id);
    return found?.name ?? '';
  };

  // --- GPS + Backend Validation Function ---
  // Returns:
  // - server response object if validation was performed
  // - { status: 'no_gps' } when geolocation couldn't be obtained and selected location is NOT Chitipa
  // - null when server validation failed (network/CORS) — caller decides
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

    // try native geolocation, fall back conditionally to Chitipa coords only
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
        // no geolocation available (older browsers)
        console.warn('[register] navigator.geolocation not available');
        // If selected location is Chitipa, use fallback coords; otherwise return no_gps
        const selectedName = getLocationName(selectedLocationId)?.toLowerCase() ?? '';
        if (selectedName.includes(FALLBACK_LOCATION_NAME)) {
          setCoords(FALLBACK_COORDS);
          setGpsStatus('Verifying coordinates (using Chitipa fallback)...');
          const serverRes = await callValidate(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng);
          setGpsStatus('');
          return serverRes;
        } else {
          setGpsStatus('');
          return { status: 'no_gps' };
        }
      }
    } catch (e: any) {
      // geolocation threw (e.g., permission denied / timeout)
      console.warn('[register] geolocation failed', e?.message ?? e);

      // If the selected location is Chitipa, attempt fallback validation; otherwise return no_gps
      try {
        const selectedName = getLocationName(selectedLocationId)?.toLowerCase() ?? '';
        if (selectedName.includes(FALLBACK_LOCATION_NAME)) {
          setCoords(FALLBACK_COORDS);
          setGpsStatus('Verifying coordinates');
          const serverRes = await callValidate(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng);
          setGpsStatus('');
          return serverRes;
        } else {
          // explicitly tell caller that no GPS was available for non-Chitipa selection
          setGpsStatus('');
          return { status: 'no_gps' };
        }
      } catch (err) {
        // If server validation for fallback fails (network/CORS), return null to let caller decide.
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
    try {
      const selectedId = parseInt(data.location_id);
      const gpsResult = await confirmLocationWithGPS(selectedId);

      // If geolocation couldn't be obtained for a non-Chitipa location -> show error and stop
      if (gpsResult && gpsResult.status === 'no_gps') {
        const locName = getLocationName(selectedId) || 'the selected location';
        setModal({
          show: true,
          title: 'GPS required',
          body: (
            <div>
              <p className="small mb-2">
                We cannot verify you're inside <strong>{locName}</strong> please select the area you are in.
              </p>
            </div>
          ),
        });
        return; // DO NOT continue registration
      }

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

        // show a second modal with explicit choices
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
      // combine names into single 'name' field for backend compatibility
      const payload = {
        name: `${data.first_name.trim()} ${data.last_name.trim()}`.trim(),
        email: data.email,
        password: data.password,
        password_confirmation: data.password_confirmation,
        phone_number: data.phone_number,
        location_id: data.location_id,
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
        body: `Welcome ${res.data?.user?.name ?? `${data.first_name} ${data.last_name}`}! Your account was created.`,
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
            // If backend returns 'name' errors, map them to both first_name and last_name so users see it.
            try {
              if (field === 'name') {
                // set both fields so the user sees the message
                setError('first_name' as any, { type: 'server', message: msg });
                setError('last_name' as any, { type: 'server', message: msg });
              } else {
                setError(field as any, { type: 'server', message: msg });
              }
            } catch {
              // ignore invalid field names
            }
          });
          // show top-level message as modal as well
          setModal({ show: true, title: 'Registration failed', body: Object.values(resp.errors).flat().join(' — ') });
        } else if (resp.message) {
          // If backend returned a general message and mentions "name", helpfully assign to both fields in the UI
          if (typeof resp.message === 'string' && resp.message.toLowerCase().includes('name')) {
            try {
              setError('first_name' as any, { type: 'server', message: resp.message });
              setError('last_name' as any, { type: 'server', message: resp.message });
            } catch { /* ignore */ }
          }
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
                {/* First + Last Name (split in UI, combined on submit) */}
                <div className="row gx-2 mb-3">
                  <div className="col">
                    <input {...register('first_name')} placeholder="First name" className={`form-control ${errors.first_name ? 'is-invalid' : ''}`} />
                    {errors.first_name && <div className="invalid-feedback">{errors.first_name.message}</div>}
                  </div>
                  <div className="col">
                    <input {...register('last_name')} placeholder="Last name" className={`form-control ${errors.last_name ? 'is-invalid' : ''}`} />
                    {errors.last_name && <div className="invalid-feedback">{errors.last_name.message}</div>}
                  </div>
                </div>

                {/* Email */}
                <div className="mb-3">
                  <input {...register('email')} placeholder="Email" type="email" className={`form-control ${errors.email ? 'is-invalid' : ''}`} />
                  {errors.email && <div className="invalid-feedback">{errors.email.message}</div>}
                </div>

                {/* Passwords */}
                <div className="mb-3">
                  <div className={`input-group ${errors.password ? 'is-invalid' : ''}`}>
                    <input {...register('password')} placeholder="Password" type={showPassword ? 'text' : 'password'} className={`form-control ${errors.password ? 'is-invalid' : ''}`} />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowPassword(s => !s)}
                      onMouseDown={(e) => e.preventDefault()}
                      aria-pressed={showPassword}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden>
                          <path d="M13.359 11.238l1.292 1.292a.5.5 0 0 1-.708.708l-1.3-1.3A8.13 8.13 0 0 1 8 13.5c-3.135 0-5.7-1.788-7.166-3.5A9.71 9.71 0 0 1 2.222 8c.42-.558 1.007-1.234 1.702-1.82L.646 1.94a.5.5 0 1 1 .708-.708l13 13a.5.5 0 0 1-.708.708l-1.287-1.287z"/>
                          <path d="M10.58 7.718a2 2 0 0 1-2.298 2.298l2.298-2.298z"/>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden>
                          <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM8 12.5A4.5 4.5 0 1 1 8 3.5a4.5 4.5 0 0 1 0 9z"/>
                          <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.password && <div className="invalid-feedback">{errors.password.message}</div>}
                </div>

                <div className="mb-3">
                  <div className={`input-group ${errors.password_confirmation ? 'is-invalid' : ''}`}>
                    <input {...register('password_confirmation')} placeholder="Confirm Password" type={showConfirmPassword ? 'text' : 'password'} className={`form-control ${errors.password_confirmation ? 'is-invalid' : ''}`} />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowConfirmPassword(s => !s)}
                      onMouseDown={(e) => e.preventDefault()}
                      aria-pressed={showConfirmPassword}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden>
                          <path d="M13.359 11.238l1.292 1.292a.5.5 0 0 1-.708.708l-1.3-1.3A8.13 8.13 0 0 1 8 13.5c-3.135 0-5.7-1.788-7.166-3.5A9.71 9.71 0 0 1 2.222 8c.42-.558 1.007-1.234 1.702-1.82L.646 1.94a.5.5 0 1 1 .708-.708l13 13a.5.5 0 0 1-.708.708l-1.287-1.287z"/>
                          <path d="M10.58 7.718a2 2 0 0 1-2.298 2.298l2.298-2.298z"/>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden>
                          <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM8 12.5A4.5 4.5 0 1 1 8 3.5a4.5 4.5 0 0 1 0 9z"/>
                          <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>
                        </svg>
                      )}
                    </button>
                  </div>
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
