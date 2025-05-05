export type UserPlan = 'None' | 'Basic' | 'Business' | 'Enterprise';

export type User = {
    id: string;
    name: string;
    email: string;
    status: 'active' | 'inactive';
    subscriptionId: string;
};

export const users: Record<string, User> = {
    'u1': { id: 'jfQKZB0XC2PNj1MBrCTY', name: 'Test', email: 'test@gmail.com', status: 'inactive', subscriptionId: '' },
};
