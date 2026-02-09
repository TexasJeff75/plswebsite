import React, { useState, useRef, useEffect } from 'react';
import { Upload, AlertCircle, CheckCircle2, X, FileSpreadsheet, Download, MapPin, Loader2, Building2 } from 'lucide-react';
import { facilitiesService } from '../services/facilitiesService';
import { geocodingService } from '../services/geocodingService';
import { organizationsService } from '../services/organizationsService';
import { facilityContactsService } from '../services/facilityContactsService';

const REQUIRED_COLUMNS = ['name', 'address', 'city', 'state'];
const OPTIONAL_COLUMNS = [
  'latitude',
  'longitude',
  'region',
  'status',
  'projected_go_live',
  'general_notes',
  'county',
  'zip_code',
  'facility_phone',
  'census',
  'capacity',
  'contact_type',
  'first_name',
  'last_name',
  'role',
  'phone',
  'email',
  'contact_notes'
];

const COLUMN_DESCRIPTIONS = {
  'facility_phone': 'Main facility phone number (shown in location card)',
  'phone': 'Individual contact phone number (specific to this contact person)'
};

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim().replace(/\s+/g, '_'));

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every(v => !v.trim())) continue;

    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() || '';
    });
    data.push(row);
  }

  return data;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

function generateTemplateCSV() {
  const headers = [
    'ID',
    'Facility Name',
    'Facility Phone',
    'Street Address',
    'City',
    'State',
    'Zip Code',
    'Region',
    'Census',
    'Capacity',
    'Contact Type',
    'First Name',
    'Last Name',
    'Role',
    'Phone',
    'Email',
    'Notes',
    'Latitude',
    'Longitude'
  ];

  const sampleRow = [
    '1',
    'Sample Facility Name',
    '816-555-1234',
    '123 Main Street',
    'Kansas City',
    'MO',
    '64108',
    'Kansas City Area',
    '50',
    '100',
    'Medical Director',
    'John',
    'Smith',
    'Medical Director',
    '816-555-5678',
    'jsmith@example.com',
    'Primary contact',
    '39.0997',
    '-94.5786'
  ];

  return [headers.join(','), sampleRow.join(',')].join('\n');
}

export default function ImportData({ onImportComplete, onClose }) {
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [detectedColumns, setDetectedColumns] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [importMode, setImportMode] = useState('merge');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, contactsAdded: 0 });
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ current: 0, total: 0 });
  const [facilitiesNeedingGeocode, setFacilitiesNeedingGeocode] = useState(0);
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  async function loadOrganizations() {
    try {
      const data = await organizationsService.getAll();
      const customers = data.filter(org => org.type === 'customer');
      setOrganizations(customers);
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  }

  const downloadTemplate = () => {
    const csv = generateTemplateCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'facility_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const validateAndMapData = (rawData, columns) => {
    const errors = [];
    const warnings = [];
    const mapping = {};

    REQUIRED_COLUMNS.forEach(reqCol => {
      const match = columns.find(c =>
        c === reqCol ||
        c.includes(reqCol) ||
        reqCol.includes(c) ||
        (reqCol === 'name' && (c.includes('facility') || c === 'site')) ||
        (reqCol === 'address' && c.includes('street'))
      );
      if (match) {
        mapping[reqCol] = match;
      } else {
        errors.push(`Required column "${reqCol}" not found in file`);
      }
    });

    OPTIONAL_COLUMNS.forEach(optCol => {
      let match;

      if (optCol === 'phone') {
        match = columns.find(c => c === 'phone' && !c.includes('facility'));
      } else if (optCol === 'facility_phone') {
        match = columns.find(c => c === 'facility_phone' || (c.includes('facility') && c.includes('phone')));
      } else {
        match = columns.find(c =>
          c === optCol ||
          c.includes(optCol) ||
          optCol.includes(c) ||
          (optCol === 'projected_go_live' && (c.includes('go_live') || c.includes('golive') || c.includes('launch'))) ||
          (optCol === 'general_notes' && c.includes('notes') && !c.includes('contact')) ||
          (optCol === 'contact_notes' && c.includes('notes') && c.includes('contact')) ||
          (optCol === 'contact_type' && c.includes('contact') && c.includes('type')) ||
          (optCol === 'first_name' && (c.includes('first') || c === 'fname')) ||
          (optCol === 'last_name' && (c.includes('last') || c === 'lname')) ||
          (optCol === 'zip_code' && (c.includes('zip') || c === 'postal'))
        );
      }

      if (match) {
        mapping[optCol] = match;
      }
    });

    if (!mapping.latitude || !mapping.longitude) {
      warnings.push('Latitude/longitude columns not found. Facilities may not appear on the map until coordinates are added.');
    }

    if (!mapping.region) {
      warnings.push('Region column not found. You may need to assign regions manually.');
    }

    return { mapping, errors, warnings };
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isCSV && !isExcel) {
      setValidationErrors(['Please upload a CSV or Excel file (.csv, .xlsx, .xls)']);
      return;
    }

    try {
      let parsedData = [];

      if (isCSV) {
        const text = await selectedFile.text();
        parsedData = parseCSV(text);
      } else if (isExcel) {
        setValidationErrors(['Excel files require the xlsx library. Please convert to CSV format, or use the CSV template.']);
        return;
      }

      if (parsedData.length === 0) {
        setValidationErrors(['No data found in file. Please check the file format.']);
        return;
      }

      const columns = Object.keys(parsedData[0]);
      setDetectedColumns(columns);

      const { mapping, errors, warnings } = validateAndMapData(parsedData, columns);
      setColumnMapping(mapping);
      setValidationWarnings(warnings);

      if (errors.length > 0) {
        setValidationErrors(errors);
        return;
      }

      const needsGeocode = parsedData.filter(row => {
        const lat = row[mapping.latitude];
        const lng = row[mapping.longitude];
        return !lat || !lng || lat === '' || lng === '';
      }).length;
      setFacilitiesNeedingGeocode(needsGeocode);

      setFile(selectedFile);
      setData(parsedData);
      setValidationErrors([]);
      setStep('preview');
    } catch (error) {
      setValidationErrors([`Error reading file: ${error.message}`]);
    }
  };

  const handleGeocode = async () => {
    if (!data) return;

    const facilitiesToGeocode = data.filter(row => {
      const lat = getMappedValue(row, 'latitude');
      const lng = getMappedValue(row, 'longitude');
      return !lat || !lng;
    }).map(row => ({
      name: getMappedValue(row, 'name'),
      address: getMappedValue(row, 'address'),
      city: getMappedValue(row, 'city'),
      county: getMappedValue(row, 'county'),
      state: getMappedValue(row, 'state')
    }));

    if (facilitiesToGeocode.length === 0) {
      setValidationWarnings(['All facilities already have coordinates.']);
      return;
    }

    setGeocoding(true);
    setGeocodeProgress({ current: 0, total: facilitiesToGeocode.length });

    try {
      const geocodedResults = await geocodingService.geocodeFacilities(
        facilitiesToGeocode,
        (current, total) => setGeocodeProgress({ current, total })
      );

      const geocodeMap = {};
      geocodedResults.forEach(result => {
        if (result.latitude && result.longitude) {
          geocodeMap[result.name] = { lat: result.latitude, lng: result.longitude };
        }
      });

      const updatedData = data.map(row => {
        const name = getMappedValue(row, 'name');
        const existingLat = getMappedValue(row, 'latitude');
        const existingLng = getMappedValue(row, 'longitude');

        if ((!existingLat || !existingLng) && geocodeMap[name]) {
          const latCol = columnMapping.latitude || 'latitude';
          const lngCol = columnMapping.longitude || 'longitude';
          return {
            ...row,
            [latCol]: geocodeMap[name].lat.toString(),
            [lngCol]: geocodeMap[name].lng.toString()
          };
        }
        return row;
      });

      if (!columnMapping.latitude) {
        setColumnMapping(prev => ({ ...prev, latitude: 'latitude' }));
      }
      if (!columnMapping.longitude) {
        setColumnMapping(prev => ({ ...prev, longitude: 'longitude' }));
      }

      setData(updatedData);

      const remainingWithoutCoords = updatedData.filter(row => {
        const lat = row[columnMapping.latitude || 'latitude'];
        const lng = row[columnMapping.longitude || 'longitude'];
        return !lat || !lng;
      }).length;

      setFacilitiesNeedingGeocode(remainingWithoutCoords);

      const successCount = geocodedResults.length;
      setValidationWarnings([
        `Geocoded ${successCount} of ${facilitiesToGeocode.length} facilities.`,
        ...(remainingWithoutCoords > 0 ? [`${remainingWithoutCoords} facilities still missing coordinates.`] : [])
      ]);
    } catch (error) {
      setValidationErrors([`Geocoding failed: ${error.message}`]);
    } finally {
      setGeocoding(false);
    }
  };

  const getMappedValue = (row, field) => {
    const mappedColumn = columnMapping[field];
    if (!mappedColumn) return null;
    const value = row[mappedColumn];
    if (value === '' || value === undefined || value === null) return null;
    return value;
  };

  const handleImport = async () => {
    if (!data) return;

    setImporting(true);
    setImportProgress({ current: 0, total: data.length, contactsAdded: 0 });

    try {
      if (importMode === 'replace') {
        const existing = await facilitiesService.getAll({});
        for (const facility of existing) {
          await facilitiesService.delete(facility.id);
        }
      }

      let successCount = 0;
      let contactsAdded = 0;
      const importErrors = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const facilityName = getMappedValue(row, 'name') || `Row ${i + 2}`;

        try {
          const lat = getMappedValue(row, 'latitude');
          const lng = getMappedValue(row, 'longitude');
          const zipCode = getMappedValue(row, 'zip_code');

          const facilityData = {
            name: getMappedValue(row, 'name'),
            address: getMappedValue(row, 'address'),
            city: getMappedValue(row, 'city'),
            state: getMappedValue(row, 'state'),
            zip: zipCode,
            phone: getMappedValue(row, 'facility_phone'),
            latitude: lat ? parseFloat(lat) : null,
            longitude: lng ? parseFloat(lng) : null,
            region: getMappedValue(row, 'region'),
            county: getMappedValue(row, 'county'),
            status: getMappedValue(row, 'status') || 'Planning',
            projected_go_live: getMappedValue(row, 'projected_go_live') || null,
            facility_notes: getMappedValue(row, 'general_notes') || null,
            organization_id: selectedOrganization || null
          };

          if (!facilityData.name) {
            importErrors.push(`Row ${i + 2}: Missing facility name, skipped`);
            continue;
          }

          const existingFacilities = await facilitiesService.getAll({
            organization_id: selectedOrganization
          });

          const isDuplicateFacility = existingFacilities.some(existing => {
            const nameMatch = existing.name.toLowerCase().trim() === facilityData.name.toLowerCase().trim();

            const addressMatch = facilityData.address && facilityData.city && facilityData.state &&
                               existing.address && existing.city && existing.state &&
                               existing.address.toLowerCase().trim() === facilityData.address.toLowerCase().trim() &&
                               existing.city.toLowerCase().trim() === facilityData.city.toLowerCase().trim() &&
                               existing.state.toLowerCase().trim() === facilityData.state.toLowerCase().trim();

            return nameMatch || addressMatch;
          });

          let facility;
          if (isDuplicateFacility) {
            console.log(`[Import] Found existing facility: ${facilityName}, will update contacts if provided`);

            facility = existingFacilities.find(existing => {
              const nameMatch = existing.name.toLowerCase().trim() === facilityData.name.toLowerCase().trim();
              const addressMatch = facilityData.address && facilityData.city && facilityData.state &&
                                 existing.address && existing.city && existing.state &&
                                 existing.address.toLowerCase().trim() === facilityData.address.toLowerCase().trim() &&
                                 existing.city.toLowerCase().trim() === facilityData.city.toLowerCase().trim() &&
                                 existing.state.toLowerCase().trim() === facilityData.state.toLowerCase().trim();
              return nameMatch || addressMatch;
            });

            if (!facility) {
              importErrors.push(`Row ${i + 2} (${facilityName}): Could not find existing facility, skipped`);
              continue;
            }
          } else {
            console.log(`[Import] Creating facility: ${facilityName}`, facilityData);

            try {
              facility = await facilitiesService.create(facilityData);
              console.log(`[Import] Facility created successfully: ${facility.id}`);
              successCount++;
            } catch (facilityError) {
              console.error(`[Import] FAILED to create facility "${facilityName}":`, facilityError);
              importErrors.push(`Row ${i + 2} (${facilityName}): Failed to create - ${facilityError.message}`);
              continue;
            }
          }

          const firstName = getMappedValue(row, 'first_name');
          const lastName = getMappedValue(row, 'last_name');
          const contactRole = getMappedValue(row, 'contact_type') || getMappedValue(row, 'role');
          const contactPhone = getMappedValue(row, 'phone');
          const contactEmail = getMappedValue(row, 'email');
          const contactNotes = getMappedValue(row, 'contact_notes');

          console.log(`[Import] Row ${i + 2}: Contact data - First: ${firstName}, Last: ${lastName}, Role: ${contactRole}, Phone: ${contactPhone}, Email: ${contactEmail}`);

          if ((firstName || lastName) && contactRole) {
            console.log(`[Import] Row ${i + 2}: Processing contact for facility ${facilityName}`);
            try {
              const contactName = [firstName, lastName].filter(Boolean).join(' ');

              const existingContacts = await facilityContactsService.getContactsByFacility(facility.id);

              const isDuplicate = existingContacts.some(existing => {
                const nameMatch = existing.name.toLowerCase() === contactName.toLowerCase();
                const emailMatch = contactEmail && existing.email &&
                                 existing.email.toLowerCase() === contactEmail.toLowerCase();
                const phoneMatch = contactPhone && existing.phone &&
                                 existing.phone.replace(/\D/g, '') === contactPhone.replace(/\D/g, '');

                if (nameMatch || emailMatch || phoneMatch) {
                  console.log(`[Import] Duplicate contact detected - Name: ${nameMatch}, Email: ${emailMatch}, Phone: ${phoneMatch}`);
                }

                return nameMatch || emailMatch || phoneMatch;
              });

              if (!isDuplicate) {
                const contactData = {
                  facility_id: facility.id,
                  name: contactName,
                  role: contactRole,
                  phone: contactPhone,
                  email: contactEmail,
                  notes: contactNotes,
                  is_primary: existingContacts.length === 0
                };

                await facilityContactsService.createContact(contactData);
                console.log(`[Import] Contact created for facility: ${contactName}`);
                contactsAdded++;
              } else {
                console.log(`[Import] Skipping duplicate contact: ${contactName}`);
              }
            } catch (contactError) {
              console.error(`[Import] Failed to create contact for facility "${facilityName}":`, contactError);
              importErrors.push(`Row ${i + 2} (${facilityName}): Contact creation failed - ${contactError.message}`);
            }
          } else {
            console.log(`[Import] Row ${i + 2}: Skipping contact - missing name or role`);
          }
        } catch (rowError) {
          console.error(`[Import] Unexpected error for row ${i + 2}:`, rowError);
          importErrors.push(`Row ${i + 2} (${facilityName}): ${rowError.message}`);
        }

        setImportProgress({ current: i + 1, total: data.length, contactsAdded });
      }

      console.log(`[Import] Complete: ${successCount} facilities created, ${contactsAdded} contacts added`);

      const summaryMessages = [];
      if (successCount > 0) {
        summaryMessages.push(`✓ ${successCount} new facilities created`);
      }
      if (contactsAdded > 0) {
        summaryMessages.push(`✓ ${contactsAdded} contacts added`);
      }

      if (successCount === 0 && contactsAdded === 0) {
        summaryMessages.push('No new data was imported. All facilities already exist and all contacts appear to be duplicates.');
      }

      if (importErrors.length > 0) {
        console.log(`[Import] Errors:`, importErrors);
        if (summaryMessages.length > 0) {
          summaryMessages.push(''); // Add blank line separator
        }
        summaryMessages.push(`Details (${importErrors.length} items processed):`);
        summaryMessages.push(...importErrors.slice(0, 20));
        if (importErrors.length > 20) {
          summaryMessages.push(`... and ${importErrors.length - 20} more (check console for full list)`);
        }
      }

      setValidationWarnings(summaryMessages);
      setImportProgress({ current: successCount, total: data.length, contactsAdded });
      setStep('complete');
      setImporting(false);

      if (successCount > 0 || contactsAdded > 0) {
        setTimeout(() => {
          onImportComplete?.();
          onClose?.();
        }, 2500);
      }
    } catch (error) {
      console.error('[Import] Fatal error:', error);
      setValidationWarnings([
        'Fatal import error occurred:',
        error.message,
        '',
        'Check the browser console for more details.'
      ]);
      setImportProgress({ current: 0, total: data.length, contactsAdded: 0 });
      setStep('complete');
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[3000]">
      <div className="bg-slate-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Import Facility Data</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-500/5 transition-all"
              >
                <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="text-white font-medium mb-1">Click to upload CSV file</p>
                <p className="text-sm text-slate-400">Supports .csv format</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <button
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download CSV Template
              </button>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Required Columns</h3>
                <div className="flex flex-wrap gap-2">
                  {REQUIRED_COLUMNS.map(col => (
                    <span key={col} className="px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Optional Columns</h3>
                <div className="flex flex-wrap gap-2">
                  {OPTIONAL_COLUMNS.map(col => (
                    <span key={col} className="px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-xs text-slate-300">
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              {validationErrors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <h3 className="font-medium text-red-400">Validation Errors</h3>
                  </div>
                  <ul className="space-y-1 text-sm text-red-300">
                    {validationErrors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && data && (
            <div className="space-y-4">
              <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-3">
                <div className="flex items-start gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                  <h3 className="font-medium text-teal-400">File validated successfully</h3>
                </div>
                <p className="text-sm text-teal-300">{data.length} facilities ready to import</p>
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <label className="font-medium text-white mb-2 block">
                      Assign to Client <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={selectedOrganization}
                      onChange={(e) => setSelectedOrganization(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Select a client...</option>
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
                    <p className="text-sm text-slate-400 mt-2">
                      All imported facilities will be assigned to this client organization.
                    </p>
                  </div>
                </div>
              </div>

              {facilitiesNeedingGeocode > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium text-blue-400 mb-1">
                        {facilitiesNeedingGeocode} facilities missing coordinates
                      </h3>
                      <p className="text-sm text-blue-300 mb-3">
                        Facilities without coordinates won't appear on the map. Click below to automatically look up coordinates based on addresses.
                      </p>
                      <button
                        onClick={handleGeocode}
                        disabled={geocoding}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {geocoding ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Geocoding {geocodeProgress.current} / {geocodeProgress.total}...
                          </>
                        ) : (
                          <>
                            <MapPin className="w-4 h-4" />
                            Add Coordinates Automatically
                          </>
                        )}
                      </button>
                      {geocoding && (
                        <div className="mt-3">
                          <div className="w-full bg-slate-800 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                              style={{
                                width: `${geocodeProgress.total > 0 ? (geocodeProgress.current / geocodeProgress.total) * 100 : 0}%`
                              }}
                            />
                          </div>
                          <p className="text-xs text-blue-300/70 mt-1">
                            Using OpenStreetMap (rate limited to 1 request/second)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {validationWarnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <h3 className="font-medium text-amber-400">Warnings</h3>
                  </div>
                  <ul className="space-y-1 text-sm text-amber-300">
                    {validationWarnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Column Mapping</h3>
                <div className="bg-slate-800/50 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(columnMapping).map(([target, source]) => (
                    <div key={target} className="flex items-center gap-2">
                      <span className="text-slate-400">{target}:</span>
                      <span className="text-teal-400">{source}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Import Mode</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800/50">
                    <input
                      type="radio"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={(e) => setImportMode(e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">Merge with existing data</p>
                      <p className="text-xs text-slate-400">Add new facilities, keep existing ones</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800/50">
                    <input
                      type="radio"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={(e) => setImportMode(e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">Replace all data</p>
                      <p className="text-xs text-slate-400">Delete all existing facilities and import new ones</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Preview (first 5 rows)</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data.slice(0, 5).map((row, idx) => {
                    const firstName = getMappedValue(row, 'first_name');
                    const lastName = getMappedValue(row, 'last_name');
                    const contactName = [firstName, lastName].filter(Boolean).join(' ');
                    const contactRole = getMappedValue(row, 'contact_type') || getMappedValue(row, 'role');

                    return (
                      <div key={idx} className="bg-slate-800/50 rounded p-3 text-xs">
                        <p className="font-medium text-white mb-1">{getMappedValue(row, 'name') || 'No name'}</p>
                        <p className="text-slate-400">
                          {getMappedValue(row, 'address')}, {getMappedValue(row, 'city')}, {getMappedValue(row, 'state')} {getMappedValue(row, 'zip_code')}
                        </p>
                        {getMappedValue(row, 'region') && (
                          <p className="text-slate-500 mt-1">Region: {getMappedValue(row, 'region')}</p>
                        )}
                        {contactName && contactRole && (
                          <p className="text-teal-400 mt-1">
                            Contact: {contactName} ({contactRole})
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {data.length > 5 && (
                    <p className="text-xs text-slate-500 text-center py-2">
                      ... and {data.length - 5} more facilities
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              {(importProgress.current > 0 || importProgress.contactsAdded > 0) ? (
                <CheckCircle2 className="w-16 h-16 text-teal-400 mb-4" />
              ) : (
                <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
              )}
              <h3 className="text-lg font-bold text-white mb-2">
                {(importProgress.current > 0 || importProgress.contactsAdded > 0) ? 'Import Complete' : 'Import Failed'}
              </h3>
              <div className="text-slate-400 space-y-1">
                {importProgress.current > 0 && (
                  <p>{importProgress.current} new {importProgress.current === 1 ? 'facility' : 'facilities'} created</p>
                )}
                {importProgress.contactsAdded > 0 && (
                  <p>{importProgress.contactsAdded} {importProgress.contactsAdded === 1 ? 'contact' : 'contacts'} added</p>
                )}
                {importProgress.current === 0 && importProgress.contactsAdded === 0 && (
                  <p>0 of {importProgress.total} facilities imported successfully</p>
                )}
              </div>
              {validationWarnings.length > 0 && (
                <div className="mt-4 text-left bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 max-h-64 overflow-y-auto w-full">
                  <p className="text-xs text-amber-400 font-medium mb-2">
                    Import Details:
                  </p>
                  {validationWarnings.map((warning, idx) => (
                    <p key={idx} className="text-xs text-amber-300 mb-1">{warning}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {importing && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
              <h3 className="text-white font-medium mb-2">Importing data...</h3>
              <p className="text-slate-400 text-sm">
                {importProgress.current} of {importProgress.total} facilities
              </p>
              <div className="w-64 bg-slate-800 rounded-full h-2 mt-4">
                <div
                  className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          {step === 'preview' && (
            <button
              onClick={handleImport}
              disabled={importing || geocoding || !selectedOrganization}
              className="flex-1 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {!selectedOrganization ? 'Select a Client First' : `Import ${data?.length} Facilities`}
            </button>
          )}
          {step === 'upload' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-medium transition-colors"
            >
              Select File
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
