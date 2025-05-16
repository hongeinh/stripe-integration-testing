import { db } from "$lib/firebase";
import type { Company } from "$lib/type";
import { doc, getDoc } from "firebase/firestore";


export const companyHandler = {
    getCompany: async (companyId: string) => {
        if (!companyId) {
            throw new Error("Company ID is required");
        }

        try {
            const companyRef = doc(db, 'companies', companyId);
            const companyDoc = await getDoc(companyRef);
            const companyData = companyDoc.data() as Company;
            return companyData;
        } catch (error) {
            console.error("Error fetching company", error);
            return null;
        }
    }
}