
-- =========================================
-- DEFAULT ROLES
-- =========================================

INSERT IGNORE INTO roles (name, description)
VALUES
    ('administrator', 'Manages the application and its users.'),
    ('standard_user', 'Uses the application with limited permissions.');


-- =========================================
-- DEFAULT PERMISSIONS
-- =========================================

INSERT IGNORE INTO permissions (name, description)
VALUES
    ('dashboard.view', 'View the application dashboard.'),
    ('users.view', 'View user accounts.'),
    ('users.create', 'Create user accounts.'),
    ('users.edit', 'Edit user account information.'),
    ('users.deactivate', 'Deactivate user accounts.'),
    ('roles.manage', 'Manage roles and their permissions.'),
    ('settings.manage', 'Manage application settings.'),
    ('activity_logs.view', 'View application activity logs.');


-- =========================================
-- ADMINISTRATOR PERMISSIONS
-- Assigns every defined permission to the administrator.
-- =========================================

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles AS r
CROSS JOIN permissions AS p
WHERE r.name = 'administrator';


-- =========================================
-- STANDARD USER PERMISSIONS
-- =========================================

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.name = 'dashboard.view'
WHERE r.name = 'standard_user';


-- =========================================
-- DEFAULT SYSTEM SETTINGS
-- =========================================

INSERT IGNORE INTO system_settings (setting_key, setting_value)
VALUES
    ('app_name', 'My System Template'),
    ('timezone', 'Asia/Manila');
