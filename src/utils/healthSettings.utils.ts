type Sex = "MALE" | "FEMALE"

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

