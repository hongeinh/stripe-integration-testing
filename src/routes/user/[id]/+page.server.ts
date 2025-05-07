import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    if (!params.id) {
        throw new Error('User ID is required');
    }
    return {
        id: params.id,
    };
};