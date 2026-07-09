import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { router } from '@inertiajs/react';

const SyncProgressBar = () => {
    const [progress, setProgress] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Initial fetch
        fetchProgress();

        // Poll every 3 seconds
        const interval = setInterval(() => {
            fetchProgress();
        }, 3000);

        // Optimistic UI: Listen for the sync request starting
        const removeStartListener = router.on('start', (event) => {
            if (event.detail.url.pathname.includes('/admin/zones/sync')) {
                setIsVisible(true);
                setProgress({
                    status: 'starting',
                    message: 'Starting sync...',
                    current: 0,
                    total: 0,
                    percentage: 0
                });
            }
        });

        return () => {
            clearInterval(interval);
            removeStartListener();
        };
    }, []);

    const fetchProgress = async () => {
        try {
            const response = await axios.get(route('admin.zones.sync-progress'));
            const data = response.data;

            if (!data || data.status === 'idle') {
                if (!isVisible) setIsVisible(false); // Only hide if we aren't optimistically showing
                return;
            }

            setProgress(data);

            if (['fetching', 'processing', 'starting'].includes(data.status)) {
                setIsVisible(true);
            } else if (['completed', 'failed'].includes(data.status)) {
                setIsVisible(true);
                setTimeout(() => {
                    setIsVisible(false);
                }, 10000); // Keep visible for 10 seconds for user to see result
            }
        } catch (error) {
            // Silently fail pollin
        }
    };

    if (!isVisible || !progress) return null;

    const isFailed = progress.status === 'failed';
    const isCompleted = progress.status === 'completed';

    return (
        <div className="flex flex-col w-full max-w-sm ml-4">
            <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-semibold ${isFailed ? 'text-red-600' : isCompleted ? 'text-green-600' : 'text-blue-600'}`}>
                    {progress.message}
                </span>
                <span className="text-xs font-medium text-gray-500">
                    {progress.current} / {progress.total} ({progress.percentage}%)
                </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div
                    className={`h-1.5 rounded-full transition-all duration-500 ease-out ${isFailed ? 'bg-red-500' : isCompleted ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                    style={{ width: `${progress.percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

export default SyncProgressBar;
