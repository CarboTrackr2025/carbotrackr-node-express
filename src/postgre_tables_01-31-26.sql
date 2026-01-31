-- Use if you want to test Locally using MySQL Workbench or XAMPP through phpMyAdmin
CREATE TABLE users (
                       user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       email TEXT NOT NULL UNIQUE,
                       password_hash TEXT NOT NULL,
                       created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE accounts (
                          account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                          gender VARCHAR(10) CHECK (gender IN ('Female','Male')),
                          date_of_birth DATE,
                          height_cm INT CHECK (height_cm > 0),
                          weight_kg DECIMAL(5,2) CHECK (weight_kg > 0),
                          created_at TIMESTAMP DEFAULT now(),
                          archived_at TIMESTAMP
);

CREATE TABLE health (
                        health_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
                        daily_calorie_goal INT CHECK (daily_calorie_goal > 0),
                        daily_carbohydrate_goal_g INT CHECK (daily_carbohydrate_goal_g >= 0),
                        diagnosed_with VARCHAR(30) CHECK (
                            diagnosed_with IN ('Not Applicable','Prediabetes','Type 2 Diabetes Mellitus')
                            ),
                        reminder_frequency SMALLINT CHECK (reminder_frequency BETWEEN 0 AND 3),
                        created_at TIMESTAMP DEFAULT now()
);


CREATE TABLE blood_pressure (
                                blood_pressure_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
                                systolic INT CHECK (systolic > 0),
                                diastolic INT CHECK (diastolic > 0 AND diastolic < systolic),
                                created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE blood_glucose (
                               blood_glucose_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                               account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
                               level DECIMAL(5,2) CHECK (level > 0),
                               unit VARCHAR(10) CHECK (unit IN ('mg/dL','mmol/L')),
                               created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE heart_rate (
                            heart_rate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
                            bpm INT CHECK (bpm > 0),
                            created_at TIMESTAMP DEFAULT now()
);


CREATE TABLE daily_step (
                            daily_step_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
                            steps INT CHECK (steps >= 0),
                            created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE food_log (
                          food_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
                          food_name TEXT NOT NULL,
                          servings DECIMAL(5,2) CHECK (servings > 0),
                          meal_type VARCHAR(10) CHECK (meal_type IN ('Breakfast','Lunch','Dinner','Snack')),
                          calories_kcal DECIMAL(7,2) CHECK (calories_kcal >= 0),
                          carbohydrate_g DECIMAL(6,2) CHECK (carbohydrate_g >= 0),
                          protein_g DECIMAL(6,2) CHECK (protein_g >= 0),
                          fat_g DECIMAL(6,2) CHECK (fat_g >= 0),
                          api_food_id TEXT,
                          source VARCHAR(30) CHECK (
                              source IN ('Manual','API','NutritionalInfoScanner','SolidFoodScanner')
                              ),
                          eaten_at TIMESTAMP,
                          created_at TIMESTAMP DEFAULT now(),
                          updated_at TIMESTAMP
);

CREATE TABLE faq (
                     faq_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                     main_topic TEXT,
                     question TEXT NOT NULL,
                     answer TEXT NOT NULL,
                     created_at TIMESTAMP DEFAULT now(),
                     updated_at TIMESTAMP,
                     deleted_at TIMESTAMP
);

CREATE TABLE inquiry (
                         inquiry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                         subject TEXT NOT NULL,
                         body TEXT NOT NULL,
                         email_address TEXT,
                         status VARCHAR(10) CHECK (status IN ('Open','Closed','Resolved')),
                         created_at TIMESTAMP DEFAULT now()
);


CREATE TABLE calorie_data (
                              calorie_data_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                              account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
                              calorie_goal INT,
                              calorie_actual INT,
                              record_date DATE NOT NULL,
                              UNIQUE (account_id, record_date)
);

CREATE TABLE carbohydrate_data (
                                   carbohydrate_data_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                   account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
                                   carbohydrate_goal_g INT,
                                   carbohydrate_actual_g INT,
                                   record_date DATE NOT NULL,
                                   UNIQUE (account_id, record_date)
);

CREATE TABLE streak (
                        streak_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,

                        current_streak INT NOT NULL DEFAULT 0,
                        longest_streak INT NOT NULL DEFAULT 0,

                        last_success_date DATE,
                        last_evaluated_date DATE,

                        created_at TIMESTAMP DEFAULT now(),
                        updated_at TIMESTAMP DEFAULT now(),

                        UNIQUE (account_id)
);
