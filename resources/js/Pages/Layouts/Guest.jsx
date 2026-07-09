import React from 'react';

export default function Guest({ children }) {
    return (
        <div
            className="min-h-screen flex items-center justify-center font-sans"
            style={{
                backgroundImage: "url('/assets/images/Background_Frame.png')"
            }}
        >
            <style>{`
                .login-card {
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                }
                .input-field {
                    transition: all 0.2s ease;
                }
                .input-field:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
                }
                input[type='password']::-ms-reveal,
                input[type='password']::-ms-clear {
                    display: none;
                }
            `}</style>
            <div className="bg-white rounded-2xl p-10 w-full max-w-xl text-center login-card">
                {children}
            </div>
        </div>
    );
}
