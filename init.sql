-- Initialize the database with some sample data
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a function to generate sample data (optional)
CREATE OR REPLACE FUNCTION create_sample_alerts() RETURNS void AS $
BEGIN
    -- Sample Pet Alert
    INSERT INTO alerts (
        id, title, description, category, location, 
        latitude, longitude, contact_name, contact_phone,
        created_at
    ) VALUES (
        uuid_generate_v4(), 
        'Lost Dog - Molly',
        'Small, tan and black mixed breed. Friendly but shy around strangers. Last seen near the park.',
        'pet',
        'Lakeside Park, Springfield',
        39.7817, -89.6501,
        'John Doe',
        '+1234567890',
        NOW() - INTERVAL '2 days'
    );
    
    -- Sample Person Alert  
    INSERT INTO alerts (
        id, title, description, category, location,
        latitude, longitude, contact_name, contact_phone,
        created_at
    ) VALUES (
        uuid_generate_v4(),
        'Missing Child',
        'Ten-year-old boy last seen at school. Wearing blue jeans and red t-shirt.',
        'person', 
        'Oak Lawn, IL',
        41.7200, -87.7542,
        'Jane Smith',
        '+0987654321',
        NOW() - INTERVAL '1 day'
    );

    -- Sample Pet Alert
    INSERT INTO alerts (
        id, title, description, category, location,
        latitude, longitude, contact_name, contact_email,
        created_at
    ) VALUES (
        uuid_generate_v4(),
        'Lost Cat',
        'White cat with blue collar wandered off from home.',
        'pet',
        'Chicago, IL', 
        41.8781, -87.6298,
        'Mike Johnson',
        'mike@email.com',
        NOW() - INTERVAL '3 days'
    );
END;
$ LANGUAGE plpgsql;

-- Call the function to create sample data
SELECT create_sample_alerts();