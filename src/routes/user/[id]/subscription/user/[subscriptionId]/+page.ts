//@ts-nocheck
import type { PageLoad } from './$types';

export const load = (({ params }) => {
    return {
        userId: params.id,
        subscriptionId: params.subscriptionId
    };
}) satisfies PageLoad; 