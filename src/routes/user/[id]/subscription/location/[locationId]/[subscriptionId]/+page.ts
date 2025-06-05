//@ts-nocheck
import type { PageLoad } from './$types';

export const load = (({ params }) => {
    return {
        userId: params.id,
        locationId: params.locationId,
        subscriptionId: params.subscriptionId
    };
}) satisfies PageLoad; 