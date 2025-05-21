//@ts-nocheck
import type { PageLoad } from './$types';

export const load = (({ params }) => {
    return {
        userId: params.id,
        subscriptionType: params.type,
        subscriptionId: params.subscriptionId
    };
}) satisfies PageLoad; 