import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../../lib/api';
import BrandMark from '../../components/brand/BrandMark';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setError('This verification link is missing its token.');
      return;
    }

    authAPI.verifyEmail(token)
      .then((res) => {
        const { access_token, user } = res.data;
        sessionStorage.setItem('token', access_token);
        sessionStorage.setItem('user', JSON.stringify(user));
        setStatus('success');
        setTimeout(() => {
          if (user.role === 'admin') navigate('/admin');
          else if (!user.restaurant_id) navigate('/onboarding');
          else navigate('/pos');
        }, 1000);
      })
      .catch((err) => {
        setStatus('error');
        setError(err.response?.data?.detail || 'Verification failed. The link may be invalid or expired.');
      });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-linen p-6">
      <div className="bg-plate p-8 rounded-3xl border border-line shadow-card max-w-md w-full text-center">
        <BrandMark className="justify-center mb-6" />
        {status === 'verifying' && (
          <>
            <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-ink/60">Verifying your email...</p>
          </>
        )}
        {status === 'success' && (
          <p className="text-forest font-medium">Email verified! Redirecting...</p>
        )}
        {status === 'error' && (
          <>
            <p className="text-ink/70 mb-4">{error}</p>
            <Link to="/register" className="text-navy font-semibold underline">Back to Register</Link>
          </>
        )}
      </div>
    </div>
  );
}
