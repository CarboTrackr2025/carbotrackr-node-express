type Sex = "MALE" | "FEMALE"
type DiagnosedWith = "NOT_APPLICABLE" | "TYPE_2_DIABETES" | "PRE_DIABETES"

type ComputeBmrParams = {
    sex: Sex
    weight_kg: number
    height_cm: number
    age_years: number
}

export const calculateAgeFromDateOfBirth = (dateOfBirth: Date): number => {
    const today = new Date()
    let age = today.getFullYear() - dateOfBirth.getFullYear()

    const hasNotHadBirthdayYet =
        today.getMonth() < dateOfBirth.getMonth() ||
        (today.getMonth() === dateOfBirth.getMonth() && today.getDate() < dateOfBirth.getDate())

    if (hasNotHadBirthdayYet) {
        age -= 1
    }

    return age
}

export const computeBmr = ({
                               sex,
                               weight_kg,
                               height_cm,
                               age_years,
                           }: ComputeBmrParams): number => {
    const base =
        (9.99 * weight_kg) +
        (6.25 * height_cm) -
        (5 * age_years)

    if (sex === "MALE") {
        return base + 5
    }

    return base - 161
}

export const getDailyCarbohydrateGrams = (
    dailyCalories: number,
    diagnosedWith: DiagnosedWith,
): number => {
    const carbohydrateRatioByDiagnosis: Record<DiagnosedWith, number> = {
        // AMDR for general adults: 45-65% of total calories
        NOT_APPLICABLE: 0.55,
        // Diabetes-oriented guidance commonly uses 45-60% of total calories
        PRE_DIABETES: 0.5,
        TYPE_2_DIABETES: 0.45,
    }

    const carbohydrateCalories = dailyCalories * carbohydrateRatioByDiagnosis[diagnosedWith]
    const carbohydrateGrams = carbohydrateCalories / 4

    // 1 gram of carbohydrate = 4 kcal
    return Number(Math.max(130, carbohydrateGrams).toFixed(2))
}

