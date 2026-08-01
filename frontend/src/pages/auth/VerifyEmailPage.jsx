import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || 'https://dinedesk-rft1.onrender.com';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    axios.post(`${API}/api/auth/verify-email`, { token })
      .then((res) => {
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setStatus('success');
        setTimeout(() => navigate('/pos'), 1500);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.detail || 'Verification failed. The link may have expired.');
      });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-xl shadow max-w-md w-full text-center">
        {status === 'verifying' && <p>Verifying your email...</p>}
        {status === 'success' && <p className="text-green-600 font-semibold">Email verified! Redirecting...</p>}
        {status === 'error' && (
          <>
            <p className="text-red-600 font-semibold mb-4">{message}</p>
            <Link to="/login" className="text-slate-800 underline">Back to Login</Link>
          </>
        )}
      </div>
    </div>
  );
}
