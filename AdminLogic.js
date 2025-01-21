// Utility function to get listing ID from URL
function getListingIdFromUrl() {
    const pathSegments = window.location.pathname.split('/');
    
    // If we're on the admin-dashboard page, get the listing ID from query params
    if (pathSegments.includes('admin-dashboard')) {
        const urlParams = new URLSearchParams(window.location.search);
        const listingId = urlParams.get('listing');
        console.log('Listing ID from query params:', listingId);
        return listingId || 'LST_ef95ad0f45b6'; // Fallback to your listing ID
    }
    
    // Otherwise get it from the path
    const listingId = pathSegments[pathSegments.length - 1];
    console.log('Listing ID from URL:', listingId);
    return listingId;
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Admin logic initialized');
    
    // Get the listing ID
    const listingId = getListingIdFromUrl();
    console.log('Using listing ID:', listingId);

    // Only proceed if we have a valid listing ID
    if (!listingId) {
        console.error('No listing ID found');
        return;
    }

    // Remove Supabase initialization, use global instance
    const supabase = window.supabase;

    // Get listing ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const listingIdFromUrl = urlParams.get('listing_id');
    console.log('Listing ID from URL:', listingIdFromUrl);

    async function initializeAdminCalendar() {
        // Get listing ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const listingId = urlParams.get('listing_id');
        
        // Fetch settings, open dates and rates for this specific listing
        const [settingsResponse, openPeriodsResponse, ratesResponse] = await Promise.all([
            supabase
                .from('listing_settings')
                .select('base_rate')
                .eq('listing_id', listingId),
            supabase
                .from('open_dates')
                .select('*')
                .eq('listing_id', listingId),
            supabase
                .from('rates')
                .select('*')
                .eq('listing_id', listingId)
        ]);

        // Fetch bookings first
        const { data: bookings, error } = await supabase
            .from('bookings')
            .select(`
                *,
                guests!bookings_guest_id_fkey (
                    name,
                    email
                )
            `)
            .eq('listing_id', listingId);

        if (error) {
            console.error('Error fetching bookings:', error);
            return;
        }

        console.log('Fetched bookings:', bookings);

        // Create flatpickr with initial config
        const adminPicker = flatpickr("[data-element='admin-date-picker']", {
            mode: "range",
            inline: false,
            altInput: true,
            altFormat: "F j, Y",
            dateFormat: "Y-m-d",
            minDate: "today",
            maxDate: new Date().setFullYear(new Date().getFullYear() + 1),
            baseRate: settingsResponse.data?.[0]?.base_rate || null,
            openPeriods: openPeriodsResponse.data || [],
            rates: ratesResponse.data || [],
            showMonths: 1,
            position: "center center",
            bookings: bookings || [],

            
            onChange: function(selectedDates) {
                if (selectedDates.length === 2) {
                    document.querySelector("[data-element='open-dates']").style.display = 'block';
                    document.querySelector("[data-element='close-dates']").style.display = 'block';
                    document.querySelector('.setrates_wrap').classList.add('is-open');
                }
            },

            onDayCreate: function(dObj, dStr, fp, dayElem) {
                const currentDate = dayElem.dateObj;
                
                // Add past-date class for dates before today
                if (currentDate < new Date().setHours(0,0,0,0)) {
                    dayElem.classList.add('past-date');
                }
                
                // Format current date for comparison
                const formattedCurrentDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                
                // Wrap the date number in a span
                const dateContent = dayElem.innerHTML;
                dayElem.innerHTML = `<span class="day-number">${dateContent}</span>`;
                
                const openPeriod = fp.config.openPeriods.find(period => 
                    formattedCurrentDate >= period.start_date && 
                    formattedCurrentDate <= period.end_date
                );
                
                // Check for specific rate
                const specificRate = fp.config.rates.find(rate => 
                    formattedCurrentDate >= rate.start_date && 
                    formattedCurrentDate <= rate.end_date
                );
                
                // Create rate element
                const rateElement = document.createElement('span');
                rateElement.className = 'day-rate';
                
                if (specificRate) {
                    rateElement.textContent = `€${specificRate.rate}`;
                } else if (fp.config.baseRate) {
                    rateElement.textContent = `€${fp.config.baseRate}`;
                } else {
                    rateElement.textContent = '-';
                }
                
                dayElem.appendChild(rateElement);
                
                if (!openPeriod) {
                    dayElem.classList.add('blocked-date');
                }

                // Add booking indicator if date is booked
                const booking = fp.config.bookings?.find(booking => 
                    formattedCurrentDate >= booking.check_in && 
                    formattedCurrentDate <= booking.check_out
                );

                if (booking) {
                    const bookingStrip = document.createElement('div');
                    bookingStrip.className = 'booking-strip';
                    
                    // Add classes for start and end dates
                    if (formattedCurrentDate === booking.check_in) {
                        bookingStrip.classList.add('booking-start');
                    }
                    if (formattedCurrentDate === booking.check_out) {
                        bookingStrip.classList.add('booking-end');
                    }

                    // Add guest name if available
                    if (booking.guests?.name) {
                        const guestName = document.createElement('span');
                        guestName.className = 'guest-name';
                        guestName.textContent = booking.guests.name;
                        bookingStrip.appendChild(guestName);
                    }

                    dayElem.appendChild(bookingStrip);
                    dayElem.classList.add('has-booking');
                }
            }
        });

        return adminPicker;
    }

    // Fetch both listing details and settings in parallel
    async function initializeListingPage() {
        console.log('Initializing listing page...');
        
        try {
            const [listingResponse, settingsResponse] = await Promise.all([
                supabase
                    .from('listings')
                    .select('name')
                    .eq('id', listingId)
                    .single(),
                supabase
                    .from('listing_settings')
                    .select('*')
                    .eq('listing_id', listingId)
            ]);

            console.log('Listing Response:', listingResponse);
            console.log('Settings Response:', settingsResponse);

            // Update listing name
            const listingNameElement = document.querySelector('[data-element="listing-name"]');
            if (listingResponse.data) {
                console.log('Setting listing name:', listingResponse.data.name);
                listingNameElement.textContent = listingResponse.data.name;
            } else {
                console.warn('No listing data found');
            }

            // Handle settings
            if (settingsResponse.data && settingsResponse.data.length > 0) {
                console.log('Found existing settings:', settingsResponse.data[0]);
                // Populate form with existing settings
                populateSettingsForm(settingsResponse.data[0]);
            } else {
                console.log('No settings found for this listing - using empty form');
                // Form will remain empty, ready for new settings
            }

        } catch (error) {
            console.error('Error initializing page:', error);
        }
    }

    function populateSettingsForm(settings) {
        const fieldMappings = {
            'base-rate-input': settings.base_rate,
            'max-guests-input': settings.max_guests,
            'extra-guest-input': settings.extra_guest_fee,
            'cleaning-fee-input': settings.cleaning_fee,
            'nightstay-tax-input': settings.nightstay_tax,
            'min-stay-input': settings.minimum_stay,
            'booking-gap-input': settings.gap_days,
            'weekly-discount-input': settings.weekly_discount_percentage * 100,
            'monthly-discount-input': settings.monthly_discount_percentage * 100
        };

        Object.entries(fieldMappings).forEach(([elementId, value]) => {
            const input = document.querySelector(`[data-element="${elementId}"]`);
            if (input && value !== null) {
                console.log(`Setting ${elementId} to ${value}`);
                input.value = value;
            }
        });
    }

    // Call the function
    initializeListingPage().catch(error => {
        console.error('Failed to initialize listing page:', error);
    });

    // Rest of your code remains the same...
    initializeAdminCalendar().then(adminPicker => {
        // Set rates button handler
        document.querySelector("[data-element='set-rates']").addEventListener('click', () => {
            document.querySelector('.ratesettings_wrap').classList.add('is-open');
        });

        // Apply rate button handler
        document.querySelector("[data-element='apply-rate']").addEventListener('click', async () => {
            const [start, end] = adminPicker.selectedDates;
            if (!start || !end) return;

            // Get and validate the rate
            const rateInput = document.querySelector("[data-element='rate-input']");
            const rate = parseInt(rateInput.value);
            if (isNaN(rate) || rate <= 0 || rate > 32767) {
                alert('Please enter a valid rate between 1 and 32767');
                return;
            }

            // Format dates using local timezone
            const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
            const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

            // First, check for any existing periods that overlap with our date range
            const { data: existingRates, error: checkError } = await supabase
                .from('rates')
                .select('*')
                .eq('listing_id', listingId)
                .or(`end_date.gte.${startDate},start_date.lte.${endDate}`);

            if (checkError) {
                console.error('Error checking rates:', checkError);
                return;
            }

            console.log('Existing rates in range:', existingRates);

            // Group periods by rate
            const sameRatePeriods = existingRates?.filter(period => period.rate === rate) || [];
            const differentRatePeriods = existingRates?.filter(period => period.rate !== rate) || [];

            // Handle periods with the same rate first (merge them)
            if (sameRatePeriods.length > 0) {
                const allDates = [...sameRatePeriods, { start_date: startDate, end_date: endDate }];
                const earliestStart = allDates.reduce((earliest, period) => {
                    return new Date(period.start_date) < new Date(earliest) ? period.start_date : earliest;
                }, startDate);

                const latestEnd = allDates.reduce((latest, period) => {
                    return new Date(period.end_date) > new Date(latest) ? period.end_date : latest;
                }, endDate);

                // Delete the existing same-rate periods
                for (const period of sameRatePeriods) {
                    await supabase.from('rates').delete().eq('id', period.id);
                }

                // Create the merged period
                await supabase.from('rates').insert({
                    listing_id: listingId,
                    start_date: earliestStart,
                    end_date: latestEnd,
                    rate: rate,
                    created_at: new Date().toISOString()
                });
            }

            // Handle periods with different rates
            for (const period of differentRatePeriods) {
                // Delete the original period
                await supabase.from('rates').delete().eq('id', period.id);

                // Create before period if needed
                if (new Date(period.start_date) < new Date(startDate)) {
                    const beforeEndDate = new Date(startDate);
                    beforeEndDate.setDate(beforeEndDate.getDate() - 1);
                    const formattedBeforeEnd = beforeEndDate.toISOString().split('T')[0];
                    
                    await supabase.from('rates').insert({
                        listing_id: listingId,
                        start_date: period.start_date,
                        end_date: formattedBeforeEnd,
                        rate: period.rate,
                        created_at: new Date().toISOString()
                    });
                }

                // Create after period if needed
                if (new Date(period.end_date) > new Date(endDate)) {
                    const afterStartDate = new Date(endDate);
                    afterStartDate.setDate(afterStartDate.getDate() + 1);
                    const formattedAfterStart = afterStartDate.toISOString().split('T')[0];
                    
                    await supabase.from('rates').insert({
                        listing_id: listingId,
                        start_date: formattedAfterStart,
                        end_date: period.end_date,
                        rate: period.rate,
                        created_at: new Date().toISOString()
                    });
                }
            }

            // Insert the new rate period if it wasn't merged with existing ones
            if (sameRatePeriods.length === 0) {
                await supabase.from('rates').insert({
                    listing_id: listingId,
                    start_date: startDate,
                    end_date: endDate,
                    rate: rate,
                    created_at: new Date().toISOString()
                });
            }

            // Fetch updated rates
            const { data: updatedRates } = await supabase
                .from('rates')
                .select('*')
                .eq('listing_id', listingId);

            // Update the calendar config
            adminPicker.config.rates = updatedRates || [];
            
            // Redraw the calendar
            adminPicker.redraw();

            // Clear the rate input and hide the rate settings
            rateInput.value = '';
            document.querySelector('.ratesettings_wrap').classList.remove('is-open');
        });

        // Open dates handler
        document.querySelector("[data-element='open-dates']").addEventListener('click', async () => {
            const [start, end] = adminPicker.selectedDates;
            if (!start || !end) return;

            // Format dates using local timezone
            const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
            const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

            console.log('Opening dates from:', startDate, 'to:', endDate);

            // Check for truly adjacent or overlapping periods
            const { data: nearbyPeriods, error: checkError } = await supabase
                .from('open_dates')
                .select('*')
                .eq('listing_id', listingId)
                .or(`end_date.gte.${startDate},start_date.lte.${endDate}`);

            if (checkError) {
                console.error('Error:', checkError);
                return;
            }

            console.log('Nearby periods:', nearbyPeriods);

            if (nearbyPeriods && nearbyPeriods.length > 0) {
                // Check if periods are truly adjacent (1 day gap or less)
                const shouldMerge = nearbyPeriods.some(period => {
                    const periodStart = new Date(period.start_date);
                    const periodEnd = new Date(period.end_date);
                    const newStart = new Date(startDate);
                    const newEnd = new Date(endDate);

                    // Check if periods are adjacent or overlapping
                    const daysBefore = (newStart - periodEnd) / (1000 * 60 * 60 * 24);
                    const daysAfter = (periodStart - newEnd) / (1000 * 60 * 60 * 24);

                    return daysBefore <= 1 && daysBefore >= -1 || daysAfter <= 1 && daysAfter >= -1;
                });

                if (shouldMerge) {
                    // Find the earliest start date and latest end date among adjacent periods
                    const allDates = [...nearbyPeriods, { start_date: startDate, end_date: endDate }];
                    const earliestStart = allDates.reduce((earliest, period) => {
                        const periodStart = new Date(period.start_date);
                        const currentEarliest = new Date(earliest);
                        return periodStart < currentEarliest ? period.start_date : earliest;
                    }, startDate);

                    const latestEnd = allDates.reduce((latest, period) => {
                        const periodEnd = new Date(period.end_date);
                        const currentLatest = new Date(latest);
                        return periodEnd > currentLatest ? period.end_date : latest;
                    }, endDate);

                    console.log('Merging periods - start:', earliestStart, 'end:', latestEnd);

                    // Delete all existing periods that will be merged
                    for (const period of nearbyPeriods) {
                        const { error: deleteError } = await supabase
                            .from('open_dates')
                            .delete()
                            .eq('id', period.id);

                        if (deleteError) {
                            console.error('Error deleting period:', deleteError);
                            return;
                        }
                    }

                    // Insert the merged period
                    const { error: insertError } = await supabase
                        .from('open_dates')
                        .insert({
                            listing_id: listingId,
                            start_date: earliestStart,
                            end_date: latestEnd
                        });

                    if (insertError) {
                        console.error('Error:', insertError);
                        return;
                    }
                } else {
                    // Create new period if not adjacent
                    console.log('Creating new period:', startDate, 'to', endDate);
                    const { error } = await supabase
                        .from('open_dates')
                        .insert({
                            listing_id: listingId,
                            start_date: startDate,
                            end_date: endDate
                        });

                    if (error) {
                        console.error('Error:', error);
                        return;
                    }
                }
            } else {
                // No nearby periods, create new one
                console.log('Creating new period:', startDate, 'to', endDate);
                const { error } = await supabase
                    .from('open_dates')
                    .insert({
                        listing_id: listingId,
                        start_date: startDate,
                        end_date: endDate
                    });

                if (error) {
                    console.error('Error:', error);
                    return;
                }
            }

            // Update the calendar with filtered data
            const { data: updatedPeriods } = await supabase
                .from('open_dates')
                .select('*')
                .eq('listing_id', listingId);
            
            adminPicker.config.openPeriods = updatedPeriods || [];
            adminPicker.redraw();
        });

        // Close dates handler
        document.querySelector("[data-element='close-dates']").addEventListener('click', async () => {
            const [start, end] = adminPicker.selectedDates;
            if (!start || !end) return;

            // Format dates using local timezone
            const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
            const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

            console.log('Closing dates from:', startDate, 'to:', endDate);

            // First, fetch all potentially affected periods
            const { data: affectedPeriods, error: fetchError } = await supabase
                .from('open_dates')
                .select('*')
                .filter('start_date', 'lte', endDate)
                .filter('end_date', 'gte', startDate);

            if (fetchError) {
                console.error('Error:', fetchError);
                return;
            }

            console.log('Affected periods:', affectedPeriods);

            // For each affected period, delete it and create new non-overlapping periods
            for (const period of affectedPeriods || []) {
                console.log('Processing period:', period);
                
                // Delete the original period
                const { error: deleteError } = await supabase
                    .from('open_dates')
                    .delete()
                    .eq('id', period.id);

                if (deleteError) {
                    console.error('Error deleting period:', deleteError);
                    return;
                }

                // Create before period if exists
                if (new Date(period.start_date) < new Date(startDate)) {
                    const beforeEndDate = new Date(startDate);
                    beforeEndDate.setDate(beforeEndDate.getDate() - 1);
                    const formattedBeforeEnd = `${beforeEndDate.getFullYear()}-${String(beforeEndDate.getMonth() + 1).padStart(2, '0')}-${String(beforeEndDate.getDate()).padStart(2, '0')}`;
                    
                    console.log('Creating before period:', period.start_date, 'to', formattedBeforeEnd);
                    const { error: beforeError } = await supabase
                        .from('open_dates')
                        .insert({
                            listing_id: listingId,
                            start_date: period.start_date,
                            end_date: formattedBeforeEnd
                        });

                    if (beforeError) {
                        console.error('Error creating before period:', beforeError);
                        return;
                    }
                }

                // Create after period if exists
                if (new Date(period.end_date) > new Date(endDate)) {
                    const afterStartDate = new Date(endDate);
                    afterStartDate.setDate(afterStartDate.getDate() + 1);
                    const formattedAfterStart = `${afterStartDate.getFullYear()}-${String(afterStartDate.getMonth() + 1).padStart(2, '0')}-${String(afterStartDate.getDate()).padStart(2, '0')}`;
                    
                    console.log('Creating after period:', formattedAfterStart, 'to', period.end_date);
                    const { error: afterError } = await supabase
                        .from('open_dates')
                        .insert({
                            listing_id: listingId,
                            start_date: formattedAfterStart,
                            end_date: period.end_date
                        });

                    if (afterError) {
                        console.error('Error creating after period:', afterError);
                        return;
                    }
                }
            }

            // Fetch updated open periods
            const { data: updatedPeriods, error: updateError } = await supabase
                .from('open_dates')
                .select('*');

            if (updateError) {
                console.error('Error fetching updated periods:', updateError);
                return;
            }
            
            console.log('Updated periods:', updatedPeriods);
            
            // Update the openPeriods in the calendar config
            adminPicker.config.openPeriods = updatedPeriods || [];
            // Redraw the calendar
            adminPicker.redraw();
        });

        // Add this near your other event listeners
        document.querySelector("[data-element='save-listing-settings']").addEventListener('click', async () => {
            console.log('Save settings clicked');
            
            // Get all form values with proper parsing
            const settings = {
                listing_id: listingId,
                base_rate: Math.floor(parseFloat(document.querySelector('[data-element="base-rate-input"]').value)),
                max_guests: Math.floor(parseFloat(document.querySelector('[data-element="max-guests-input"]').value)),
                extra_guest_fee: Math.floor(parseFloat(document.querySelector('[data-element="extra-guest-input"]').value)),
                cleaning_fee: Math.floor(parseFloat(document.querySelector('[data-element="cleaning-fee-input"]').value)),
                nightstay_tax: parseFloat(document.querySelector('[data-element="nightstay-tax-input"]').value),
                minimum_stay: Math.floor(parseFloat(document.querySelector('[data-element="min-stay-input"]').value)),
                gap_days: Math.floor(parseFloat(document.querySelector('[data-element="booking-gap-input"]').value)),
                weekly_discount_percentage: parseFloat(document.querySelector('[data-element="weekly-discount-input"]').value) / 100,
                monthly_discount_percentage: parseFloat(document.querySelector('[data-element="monthly-discount-input"]').value) / 100,
                updated_at: new Date().toISOString()
            };

            console.log('Settings to save:', settings);

            try {
                // First check if settings exist for this listing
                const { data: existingSettings } = await supabase
                    .from('listing_settings')
                    .select('*')
                    .eq('listing_id', listingId);

                let response;
                if (existingSettings && existingSettings.length > 0) {
                    // Update existing settings
                    response = await supabase
                        .from('listing_settings')
                        .update(settings)
                        .eq('listing_id', listingId);
                } else {
                    // Insert new settings
                    response = await supabase
                        .from('listing_settings')
                        .insert([{
                            ...settings,
                            created_at: new Date().toISOString()
                        }]);
                }

                if (response.error) {
                    console.error('Error saving settings:', response.error);
                    alert('Failed to save settings. Please try again.');
                } else {
                    console.log('Settings saved successfully:', response);
                    alert('Settings saved successfully!');
                }

            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred while saving settings.');
            }
        });
    });

    // Styles remain the same...
    const styles = `
        /* Calendar Theme Variables */
        :root {
            /* Colors */
            --calendar-bg-default: #fff;
            --calendar-bg-hover: #222;
            --calendar-bg-blocked: #EBEBEB;
            --calendar-bg-range: #222;
            --calendar-bg-range-end: #222;
            
            /* Text Colors */
            --calendar-text-default: #222;
            --calendar-text-hover: #fff;
            --calendar-text-blocked: #222;
            --calendar-text-past: #ccc;
            --calendar-text-range: #fff;
            
            /* Rate Colors */
            --calendar-rate-default: #222;
            --calendar-rate-hover: #fff;
            --calendar-rate-range: #fff;
            --calendar-rate-past: #ccc;
            
            /* Border Colors */
            --calendar-border-default: #ddd;
            --calendar-border-hover: #ddd;
            --calendar-border-range: #ddd;
            
            /* Opacity */
            --calendar-opacity-past: 0.4;
            --calendar-opacity-blocked: 1;
            
            /* Spacing */
            --calendar-cell-padding: 1em;
            --calendar-rate-margin: 1.5em;
            
            /* Font Sizes */
            --calendar-date-size: 1.25em;
            --calendar-rate-size: 0.875rem;
            
            /* Font Weights */
            --calendar-date-weight: 600;
            --calendar-rate-weight: normal;
            
            /* Border Radius */
            --calendar-cell-radius: 0.5rem;
        }

        .flatpickr-day {
            width: 100% !important;
            height: 100% !important;
            line-height: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            padding: var(--calendar-cell-padding) !important;
            font-weight: var(--calendar-date-weight) !important;
            border-color: var(--calendar-border-default) !important;
            margin: 0 !important;
            min-width: 2rem !important;
            background-color: var(--calendar-bg-default);
            color: var(--calendar-text-default);
        }

        .flatpickr-day:hover {
            background-color: var(--calendar-bg-hover);
            border-radius: var(--calendar-cell-radius);
            color: var(--calendar-text-hover);
            border-color: var(--calendar-border-hover) !important;
        }

        .flatpickr-day:hover .day-rate {
            color: var(--calendar-rate-hover);
        }

        .flatpickr-day.past-date {
            color: var(--calendar-text-past) !important;
            background-color: var(--calendar-bg-past) !important;
        }
            
        .flatpickr-day.inRange {
            background-color: var(--calendar-bg-range) !important;
            color: var(--calendar-text-range) !important;
            border-color: var(--calendar-border-range) !important;
        }

        .flatpickr-day.inRange .day-rate,
        .flatpickr-day.selected .day-rate,
        .flatpickr-day.startRange .day-rate,
        .flatpickr-day.endRange .day-rate {
            color: var(--calendar-rate-range);
        }

        .flatpickr-day.blocked-date {
            text-decoration: none !important;
            background-color: var(--calendar-bg-blocked) !important;
            border-color: var(--calendar-border-default) !important;
            opacity: var(--calendar-opacity-blocked);
        }
        
        .flatpickr-day.blocked-date:hover,
        .flatpickr-day.blocked-date.inRange {
            background-color: var(--calendar-bg-hover) !important;
            border-color: var(--calendar-border-hover) !important;
            color: var(--calendar-text-hover) !important;
        }
        
        .flatpickr-day.blocked-date.inRange .day-rate {
            color: var(--calendar-rate-range) !important;
        }
        
        .day-rate {
            display: block;
            font-size: var(--calendar-rate-size);
            color: var(--calendar-rate-default);
            margin-top: var(--calendar-rate-margin);
            font-weight: var(--calendar-rate-weight);
        }

        .flatpickr-days {
            width: 100% !important;
        }

        .dayContainer {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
        }

        .flatpickr-day.startRange,
        .flatpickr-day.endRange {
            background-color: var(--calendar-bg-range-end) !important;
            border-color: var(--calendar-border-range) !important;
            color: var(--calendar-text-range) !important;
        }

        .flatpickr-day.startRange .day-rate,
        .flatpickr-day.endRange .day-rate {
            color: var(--calendar-rate-range) !important;
        }

        .flatpickr-day.blocked-date .day-number {
            text-decoration: line-through !important;
        }

        .flatpickr-day.blocked-date .day-rate {
            text-decoration: none !important;
        }

        /* Override cursor for calendar inputs */
        .w-input[readonly],
        input[data-element='admin-date-picker'].w-input[readonly] {
            cursor: pointer !important;
        }

        /* Add hover styles for today's date */
        .flatpickr-day.today:hover,
        .flatpickr-day.today.inRange,
        .flatpickr-day.today.startRange,
        .flatpickr-day.today.endRange {
            background-color: var(--calendar-bg-hover) !important;
            color: var(--calendar-text-hover) !important;
            border-color: var(--calendar-border-hover) !important;
        }

        .flatpickr-day.today:hover .day-rate,
        .flatpickr-day.today.inRange .day-rate,
        .flatpickr-day.today.startRange .day-rate,
        .flatpickr-day.today.endRange .day-rate {
            color: var(--calendar-rate-hover) !important;
        }

        /* Calendar container sizing */
        .flatpickr-calendar {
            width: min(100%, 500px) !important;
            min-width: 280px !important;
        }

        .flatpickr-rContainer {
            width: 100% !important;
        }

        .flatpickr-days {
            width: 100% !important;
        }

        .dayContainer {
            display: grid !important;
            grid-template-columns: repeat(7, 1fr) !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            gap: 0 !important;
        }

        .flatpickr-day.past-date .day-rate {
            color: var(--calendar-rate-past) !important;
        }

        /* Booking styles */
        .flatpickr-day.has-booking {
            overflow: visible;
            position: relative;
        }

        .booking-strip {
            position: absolute;
            left: -1px;
            right: -1px;
            bottom: 10px;
            top: auto;
            height: 32px;
            background: var(--calendar-bg-hover);
            z-index: 2;
        }

        .booking-strip.booking-start {
            border-top-left-radius: 100px;
            border-bottom-left-radius: 100px;
            left: 10%;
        }

        .booking-strip.booking-end {
            border-top-right-radius: 100px;
            border-bottom-right-radius: 100px;
            right: -120%;
        }

        .guest-name {
            position: absolute;
            color: white;
            font-size: 12px;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            padding: 0 8px;
        }

        /* Ensure the date number stays above the booking strip */
        .flatpickr-day .day-number {
            position: relative;
            z-index: 3;
        }

    
    `;

    document.head.insertAdjacentHTML('beforeend', `<style>${styles}</style>`);

    // Add this after your DOM content loaded event
    function setupIntegerInputs() {
        // Fields that should only accept integers
        const integerFields = [
            'base-rate-input',
            'max-guests-input',
            'extra-guest-input',
            'cleaning-fee-input',
            'min-stay-input',
            'booking-gap-input'
        ];

        integerFields.forEach(fieldId => {
            const input = document.querySelector(`[data-element="${fieldId}"]`);
            if (input) {
                // Prevent decimal input
                input.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                });

                // Ensure integer on blur
                input.addEventListener('blur', (e) => {
                    const value = e.target.value;
                    if (value) {
                        e.target.value = Math.floor(parseFloat(value));
                    }
                });
            }
        });

        // Fields that can have decimals (percentage and tax)
        const decimalFields = [
            'nightstay-tax-input',
            'weekly-discount-input',
            'monthly-discount-input'
        ];

        decimalFields.forEach(fieldId => {
            const input = document.querySelector(`[data-element="${fieldId}"]`);
            if (input) {
                // Allow decimals but clean input
                input.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/[^0-9.]/g, '');
                    // Ensure only one decimal point
                    const parts = e.target.value.split('.');
                    if (parts.length > 2) {
                        e.target.value = parts[0] + '.' + parts.slice(1).join('');
                    }
                });
            }
        });

        // Special handling for percentage fields
        const percentageFields = [
            'weekly-discount-input',
            'monthly-discount-input'
        ];

        percentageFields.forEach(fieldId => {
            const input = document.querySelector(`[data-element="${fieldId}"]`);
            if (input) {
                // Convert decimal to percentage when displaying
                if (input.value) {
                    input.value = (parseFloat(input.value) * 100).toString();
                }

                // Allow only whole numbers for percentages
                input.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                    // Ensure value doesn't exceed 100
                    if (parseInt(e.target.value) > 100) {
                        e.target.value = '100';
                    }
                });
            }
        });
    }

    // Call this function after DOM loads
    setupIntegerInputs();
});