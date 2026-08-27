import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../../lib/api';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-xl shadow max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Verifying your email...</p>
          </>
        )}
        {status === 'success' && (
          <p className="text-gray-600">Email verified! Redirecting...</p>
        )}
        {status === 'error' && (
          <>
            <p className="text-gray-600 mb-4">{error}</p>
            <Link to="/register" className="text-black underline">Back to Register</Link>
          </>
        )}
      </div>
    </div>
  );
}
