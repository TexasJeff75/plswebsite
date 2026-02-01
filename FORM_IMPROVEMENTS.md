# Form Improvements Guide

This document outlines the improvements made to facility forms and provides a pattern for upgrading other form components.

## New Form Components & Utilities

### 1. **FormField Component** (`src/components/FormField.jsx`)
Provides consistent form field rendering with:
- Label with required indicator
- Help text
- Error display with icon
- Flexible children (works with any input type)

**Usage:**
```jsx
<FormField
  label="Email Address"
  help="We'll never share your email"
  error={errors.email}
  required
>
  <input
    type="email"
    value={formData.email}
    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
    className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600..."
  />
</FormField>
```

### 2. **FormError Component** (`src/components/FormError.jsx`)
Displays form-level errors at the top with dismiss button:
- Consistent styling
- Close button
- Clear visual hierarchy

**Usage:**
```jsx
<FormError
  message={error}
  onDismiss={() => setError(null)}
/>
```

### 3. **Form Validation Utility** (`src/utils/formValidation.js`)
Provides reusable validators:
- `required(value, fieldName)`
- `email(value)`
- `dateRange(startDate, endDate, fieldNames)`
- `coordinates(lat, lon)`
- `npi(value)`
- `phone(value)`
- `positiveNumber(value, fieldName)`
- And more...

**Usage:**
```javascript
import { validateForm, validators } from '../../utils/formValidation';

const rules = {
  email: validators.email,
  phone: (val) => validators.required(val, 'Phone number'),
  birthDate: validators.date
};

const { isValid, errors } = validateForm(formData, rules);
```

### 4. **Dirty Form Hook** (`src/hooks/useDirtyForm.js`)
Prevents users from navigating away with unsaved changes:
- Detects dirty forms
- Shows confirmation dialog
- Handles beforeunload event

**Usage:**
```jsx
import { useDirtyForm, DirtyFormWarning } from '../../hooks/useDirtyForm';

const { showWarning, handleDiscard, handleCancel } = useDirtyForm(
  isDirty,
  () => setFormData(initialData)
);

return <>
  <DirtyFormWarning
    isOpen={showWarning}
    onDiscard={handleDiscard}
    onCancel={handleCancel}
  />
</>;
```

## Improved LocationTab Pattern

The LocationTab has been refactored as the reference implementation. Key improvements:

### Before Issues:
- ❌ No client-side validation
- ❌ Inconsistent error display
- ❌ No validation error messages shown
- ❌ Minimal success feedback
- ❌ Poor field labels and help text
- ❌ Tight spacing and unclear organization

### After Improvements:
- ✅ Client-side validation with clear error messages
- ✅ FormField component for consistency
- ✅ Red border highlight on error fields
- ✅ Success message with auto-dismiss
- ✅ Descriptive labels and help text
- ✅ Better spacing and visual organization
- ✅ Disabled geocode button when address missing
- ✅ Validation happens before API call

## Upgrading Other Form Components

Follow this pattern to upgrade other facility tabs:

### Step 1: Add Imports
```javascript
import FormField from '../FormField';
import FormError from '../FormError';
import { validateForm, validators } from '../../utils/formValidation';
```

### Step 2: Add State for Validation & Success
```javascript
const [validationErrors, setValidationErrors] = useState({});
const [error, setError] = useState(null);
const [success, setSuccess] = useState(null);
```

### Step 3: Create Validation Rules
```javascript
async function saveChanges() {
  // Define validation rules
  const rules = {
    fieldName: (val) => validators.required(val, 'Field Name'),
    email: validators.email,
    startDate: validators.date,
    // Add more rules...
  };

  // Validate before save
  const { isValid, errors } = validateForm(editedData, rules);
  if (!isValid) {
    setValidationErrors(errors);
    setError('Please fix the errors below');
    return;
  }

  // Save...
  try {
    await api.update(editedData);
    setSuccess('Saved successfully');
    setTimeout(() => setSuccess(null), 3000);
  } catch (err) {
    setError(err.message);
  }
}
```

### Step 4: Replace Form Inputs with FormField
```javascript
// Before:
<div>
  <label className="text-slate-400 text-xs block mb-1">Name</label>
  <input type="text" value={data.name} onChange={...} />
</div>

// After:
<FormField
  label="Full Name"
  help="Enter your complete name"
  error={validationErrors.name}
  required
>
  <input
    type="text"
    value={data.name}
    onChange={...}
    className={`w-full bg-slate-700 text-white px-3 py-2 rounded border ${
      validationErrors.name ? 'border-red-500' : 'border-slate-600'
    } focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm`}
  />
</FormField>
```

### Step 5: Add Error/Success Display
```javascript
<FormError message={error} onDismiss={() => setError(null)} />

{success && (
  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3 mb-4">
    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
    <p className="text-sm text-green-200">{success}</p>
  </div>
)}
```

## Priority Tabs to Upgrade

Listed by impact on user experience:

1. **EquipmentTab** - Most fields (80+), most complex form
2. **MilestonesTab** - Large dynamic lists
3. **PersonnelTab** - Multiple related sections
4. **RegulatoryTab** - Multiple sections with date validation
5. **TrainingTab** - Conditional fields with date ranges
6. **OverviewTab** - Key configuration fields
7. **DocumentsTab** - File handling, expiration dates
8. **IntegrationTab** - System configuration

## Form Best Practices Applied

### Organization
- Group related fields together
- Use clear section headers
- Separate required from optional fields
- Logical flow from top to bottom

### Validation
- Validate before API call
- Show all errors at once
- Explain validation rules (help text)
- Prevent save if errors exist

### Feedback
- Show loading state during save
- Disable buttons while saving
- Display success messages (3 sec auto-dismiss)
- Show error messages with dismiss option

### Accessibility
- Label all form fields
- Required indicators (*) visible
- Error messages in red with icon
- Focus indicators on inputs
- Clear visual hierarchy

### Mobile Responsiveness
- Single column on mobile
- Touch-friendly button sizes
- Full-width inputs
- Readable text (min 16px)

## Testing Checklist

When upgrading a form component:

- [ ] All fields have labels
- [ ] Required fields marked with *
- [ ] Validation works for each field type
- [ ] Error messages are clear and specific
- [ ] Errors shown with red border and icon
- [ ] Can't submit form with validation errors
- [ ] Success message appears after save
- [ ] Loading spinner shows during save
- [ ] Buttons disabled while saving
- [ ] No unsaved changes warning (for now)
- [ ] Mobile layout works
- [ ] Tab order makes sense
- [ ] Error message can be dismissed

## Common Validation Scenarios

### Date Range Validation
```javascript
const rules = {
  startDate: [
    (val) => validators.required(val, 'Start date'),
    (val) => validators.date(val)
  ],
  endDate: [
    (val) => validators.required(val, 'End date'),
    (val) => validators.date(val),
    (val) => validators.dateRange(editedData.startDate, val, {
      start: 'Start date',
      end: 'End date'
    })
  ]
};
```

### Conditional Required Fields
```javascript
const rules = {
  blocked: () => null, // checkbox, always optional
  blockedReason: (val) => {
    if (editedData.blocked && !val) {
      return 'Please explain why this milestone is blocked';
    }
    return null;
  }
};
```

### Multiple Validation Rules
```javascript
const rules = {
  email: [
    (val) => validators.required(val, 'Email'),
    validators.email,
    (val) => validators.minLength(val, 5, 'Email')
  ]
};
```

## Future Enhancements

Potential improvements beyond current scope:

- **Real-time validation** - Validate as user types, with debounce
- **Async validation** - Check email/username uniqueness via API
- **Smart form save** - Only send changed fields to API
- **Undo/redo** - Track form history
- **Auto-save** - Save periodically with user confirmation
- **Multi-step forms** - Break long forms into wizards
- **Form templates** - Save/load common configurations
- **Field dependencies** - Show/hide fields based on other values
- **Custom error messages** - API-specific error formatting
- **Internationalization** - Multi-language validation messages

## Questions?

Refer to LocationTab.jsx as the reference implementation for any questions about the pattern.
