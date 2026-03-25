-- =========================================
-- APP_USER
-- =========================================
INSERT INTO app_user (
    name,
    surname,
    username,
    email,
    password_hash, -- Password123
    role,
    is_active,
    last_login_at
)
VALUES
    ('Admin',     'One',       'admin1',      'admin1@test.com',      '$argon2id$v=19$m=65536,t=3,p=4$//OMCf7VHis7MgTbDiCklg$9j1rYzK+Y3WSC78JN4IXEv+//rZF6oXfUtGUc6/LMR4', 'admin',     TRUE, now()),
    ('Admin',     'Two',       'admin2',      'admin2@test.com',      '$argon2id$v=19$m=65536,t=3,p=4$//OMCf7VHis7MgTbDiCklg$9j1rYzK+Y3WSC78JN4IXEv+//rZF6oXfUtGUc6/LMR4', 'admin',     TRUE, NULL),
    ('Shelter',   'One',       'shelter1',    'shelter1@test.com',    '$argon2id$v=19$m=65536,t=3,p=4$//OMCf7VHis7MgTbDiCklg$9j1rYzK+Y3WSC78JN4IXEv+//rZF6oXfUtGUc6/LMR4', 'shelter',   TRUE, now()),
    ('Shelter',   'Two',       'shelter2',    'shelter2@test.com',    '$argon2id$v=19$m=65536,t=3,p=4$//OMCf7VHis7MgTbDiCklg$9j1rYzK+Y3WSC78JN4IXEv+//rZF6oXfUtGUc6/LMR4', 'shelter',   TRUE, NULL),
    ('Volunteer', 'One',       'volunteer1',  'volunteer1@test.com',  '$argon2id$v=19$m=65536,t=3,p=4$//OMCf7VHis7MgTbDiCklg$9j1rYzK+Y3WSC78JN4IXEv+//rZF6oXfUtGUc6/LMR4', 'volunteer', TRUE, now()),
    ('Volunteer', 'Two',       'volunteer2',  'volunteer2@test.com',  '$argon2id$v=19$m=65536,t=3,p=4$//OMCf7VHis7MgTbDiCklg$9j1rYzK+Y3WSC78JN4IXEv+//rZF6oXfUtGUc6/LMR4', 'volunteer', TRUE, NULL)
ON CONFLICT DO NOTHING;


-- =========================================
-- SHELTER
-- =========================================
INSERT INTO shelter (
    name,
    description,
    email,
    phone,
    website,
    address,
    city,
    postal_code,
    country,
    is_verified,
    is_active,
    created_by
)
VALUES
    (
        'Happy Paws Shelter',
        'A friendly shelter for dogs and cats',
        'contact@happypaws.lt',
        '+37060000001',
        'https://happypaws.lt',
        'Gedimino pr. 1',
        'Vilnius',
        '01103',
        'Lithuania',
        TRUE,
        TRUE,
        (SELECT id FROM app_user WHERE username = 'shelter1')
    ),
    (
        'Safe Haven Shelter',
        'Rescue and adoption center for abandoned animals',
        'info@safehaven.lt',
        '+37060000002',
        'https://safehaven.lt',
        'Laisvės al. 10',
        'Kaunas',
        '44240',
        'Lithuania',
        FALSE,
        TRUE,
        (SELECT id FROM app_user WHERE username = 'shelter2')
    )
ON CONFLICT DO NOTHING;


-- =========================================
-- ANIMAL
-- =========================================
INSERT INTO animal (
    shelter_id,
    name,
    code,
    species,
    breed,
    sex,
    birth_date,
    color,
    description,
    status
)
VALUES
    -- Shelter 1
    ((SELECT id FROM shelter WHERE name = 'Happy Paws Shelter'), 'Max',     'HP001', 'dog', 'Labrador',            'male',   '2020-05-10', 'brown',       'Friendly and energetic', 'available'),
    ((SELECT id FROM shelter WHERE name = 'Happy Paws Shelter'), 'Bella',   'HP002', 'dog', 'Beagle',              'female', '2019-08-15', 'tricolor',    'Loves attention',        'available'),
    ((SELECT id FROM shelter WHERE name = 'Happy Paws Shelter'), 'Luna',    'HP003', 'cat', 'Siamese',             'female', '2021-03-20', 'cream',       'Calm and quiet',         'reserved'),
    ((SELECT id FROM shelter WHERE name = 'Happy Paws Shelter'), 'Charlie', 'HP004', 'dog', 'Poodle',              'male',   '2018-11-01', 'white',       'Very smart',             'adopted'),
    ((SELECT id FROM shelter WHERE name = 'Happy Paws Shelter'), 'Lucy',    'HP005', 'cat', 'British Shorthair',   'female', '2022-01-12', 'gray',        'Playful kitten',         'available'),
    ((SELECT id FROM shelter WHERE name = 'Happy Paws Shelter'), 'Rocky',   'HP006', 'dog', 'Bulldog',             'male',   '2017-06-30', 'brindle',     'Lazy but lovable',       'foster'),
    ((SELECT id FROM shelter WHERE name = 'Happy Paws Shelter'), 'Milo',    'HP007', 'cat', 'Maine Coon',          'male',   '2020-09-05', 'brown',       'Big and fluffy',         'available'),
    ((SELECT id FROM shelter WHERE name = 'Happy Paws Shelter'), 'Daisy',   'HP008', 'dog', 'Cocker Spaniel',      'female', '2019-12-25', 'golden',      'Very friendly',          'medical_hold'),
    ((SELECT id FROM shelter WHERE name = 'Happy Paws Shelter'), 'Simba',   'HP009', 'cat', 'Mixed',               'male',   '2021-07-18', 'orange',      'Curious and active',     'available'),
    ((SELECT id FROM shelter WHERE name = 'Happy Paws Shelter'), 'Nala',    'HP010', 'cat', 'Mixed',               'female', '2022-04-10', 'black',       'Shy at first',           'available'),

    -- Shelter 2
    ((SELECT id FROM shelter WHERE name = 'Safe Haven Shelter'), 'Buddy',   'SH001', 'dog', 'Golden Retriever',    'male',   '2018-02-14', 'golden',      'Loyal companion',        'available'),
    ((SELECT id FROM shelter WHERE name = 'Safe Haven Shelter'), 'Molly',   'SH002', 'dog', 'Border Collie',       'female', '2020-06-22', 'black/white', 'Very active',            'reserved'),
    ((SELECT id FROM shelter WHERE name = 'Safe Haven Shelter'), 'Oliver',  'SH003', 'cat', 'Persian',             'male',   '2019-09-30', 'white',       'Needs grooming',         'available'),
    ((SELECT id FROM shelter WHERE name = 'Safe Haven Shelter'), 'Chloe',   'SH004', 'cat', 'Ragdoll',             'female', '2021-11-11', 'cream',       'Very calm',              'adopted'),
    ((SELECT id FROM shelter WHERE name = 'Safe Haven Shelter'), 'Jack',    'SH005', 'dog', 'Mixed',               'male',   '2017-03-05', 'brown',       'Rescued stray',          'available'),
    ((SELECT id FROM shelter WHERE name = 'Safe Haven Shelter'), 'Lily',    'SH006', 'cat', 'Mixed',               'female', '2022-02-02', 'gray',        'Playful',                'available'),
    ((SELECT id FROM shelter WHERE name = 'Safe Haven Shelter'), 'Oscar',   'SH007', 'dog', 'Dachshund',           'male',   '2020-10-10', 'black/tan',   'Funny personality',      'foster'),
    ((SELECT id FROM shelter WHERE name = 'Safe Haven Shelter'), 'Ruby',    'SH008', 'dog', 'Husky',               'female', '2019-01-19', 'white/gray',  'Needs space',            'medical_hold'),
    ((SELECT id FROM shelter WHERE name = 'Safe Haven Shelter'), 'Leo',     'SH009', 'cat', 'Bengal',              'male',   '2021-05-05', 'spotted',     'Very active',            'available'),
    ((SELECT id FROM shelter WHERE name = 'Safe Haven Shelter'), 'Coco',    'SH010', 'cat', 'Mixed',               'female', '2022-08-08', 'black/white', 'Sweet and calm',         'lost')
ON CONFLICT DO NOTHING;