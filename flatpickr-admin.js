document.addEventListener('DOMContentLoaded', function() {
    const BASE_RATE = 100;

    // Initialize Supabase
    const supabase = window.supabase.createClient(
        'https://uzjmmrthjfmaizbeihkq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6am1tcnRoamZtYWl6YmVpaGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxMTMzMjMsImV4cCI6MjA1MjY4OTMyM30.a39DgG8nvpXDjV4ALWcyCxvCISkgVUUwmwuDDpnKtAM'
    );

    async function initializeAdminCalendar() {
        // Fetch both open dates and rates
        const { data: openPeriods, error: openError } = await supabase
            .from('open_dates')
            .select('*');
        
        const { data: rates, error: ratesError } = await supabase
            .from('rates')
            .select('*');
        
        if (openError) {
            console.error('Error fetching open dates:', openError);
            return;
        }

        if (ratesError) {
            console.error('Error fetching rates:', ratesError);
            return;
        }

        // Create flatpickr with initial config including both openPeriods and rates
        const adminPicker = flatpickr("[data-element='admin-date-picker']", {
            mode: "range",
            inline: false,
            dateFormat: "Y-m-d",
            minDate: "today",
            openPeriods: openPeriods || [],
            rates: rates || [], // Initialize rates array
            
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
                    return; // Skip adding rate for past dates
                }
                
                // Format current date for comparison
                const formattedCurrentDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                
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
                    rateElement.textContent = `$${specificRate.rate}`;
                } else {
                    rateElement.textContent = `$${BASE_RATE}`;
                }
                
                dayElem.appendChild(rateElement);
                
                if (!openPeriod) {
                    dayElem.classList.add('blocked-date');
                }
            }
        });

        return adminPicker;
    }

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

            // Check for overlapping rate periods
            const { data: overlappingRates, error: checkError } = await supabase
                .from('rates')
                .select('*')
                .filter('start_date', 'lte', endDate)
                .filter('end_date', 'gte', startDate);

            if (checkError) {
                console.error('Error checking rates:', checkError);
                return;
            }

            // If there are overlapping periods, delete them
            if (overlappingRates && overlappingRates.length > 0) {
                for (const period of overlappingRates) {
                    const { error: deleteError } = await supabase
                        .from('rates')
                        .delete()
                        .eq('id', period.id);

                    if (deleteError) {
                        console.error('Error deleting rate:', deleteError);
                        return;
                    }
                }
            }

            // Insert the new rate period
            const { error: insertError } = await supabase
                .from('rates')
                .insert({
                    start_date: startDate,
                    end_date: endDate,
                    rate: rate,
                    created_at: new Date().toISOString()
                });

            if (insertError) {
                console.error('Error setting rate:', insertError);
                return;
            }

            // Fetch updated rates
            const { data: updatedRates } = await supabase
                .from('rates')
                .select('*');

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

            // Adjust the filters to include adjacent dates by adding/subtracting a day
            const adjacentStartDate = new Date(startDate);
            adjacentStartDate.setDate(adjacentStartDate.getDate() - 1);
            const adjacentEndDate = new Date(endDate);
            adjacentEndDate.setDate(adjacentEndDate.getDate() + 1);

            const formattedAdjacentStart = `${adjacentStartDate.getFullYear()}-${String(adjacentStartDate.getMonth() + 1).padStart(2, '0')}-${String(adjacentStartDate.getDate()).padStart(2, '0')}`;
            const formattedAdjacentEnd = `${adjacentEndDate.getFullYear()}-${String(adjacentEndDate.getMonth() + 1).padStart(2, '0')}-${String(adjacentEndDate.getDate()).padStart(2, '0')}`;

            // Check for overlapping OR adjacent periods
            const { data: nearbyPeriods, error: checkError } = await supabase
                .from('open_dates')
                .select('*')
                .filter('start_date', 'lte', formattedAdjacentEnd)
                .filter('end_date', 'gte', formattedAdjacentStart);

            if (checkError) {
                console.error('Error:', checkError);
                return;
            }

            console.log('Nearby periods:', nearbyPeriods);

            if (nearbyPeriods && nearbyPeriods.length > 0) {
                // Find the earliest start date and latest end date among all periods
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
                        start_date: earliestStart,
                        end_date: latestEnd
                    });

                if (insertError) {
                    console.error('Error:', insertError);
                    return;
                }
            } else {
                console.log('Creating new period:', startDate, 'to', endDate);
                // If no nearby periods, insert new period
                const { error } = await supabase
                    .from('open_dates')
                    .insert({
                        start_date: startDate,
                        end_date: endDate
                    });

                if (error) {
                    console.error('Error:', error);
                    return;
                }
            }

            // Update the calendar
            const { data: updatedPeriods } = await supabase
                .from('open_dates')
                .select('*');
            
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
    });

    // Styles remain the same...
    const styles = `
        .flatpickr-day.blocked-date {
            background-color: #ffebee;
            border-color: #ffcdd2;
            color: #c62828;
        }
        .flatpickr-day.blocked-date:hover {
            background-color: #ffcdd2;
        }
        .flatpickr-day.blocked-date.selected {
            background-color: #c62828;
            border-color: #c62828;
            color: white;
        }
        .admin-actions {
            margin-top: 1rem;
            display: flex;
            gap: 1rem;
        }
        .admin-actions button {
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
        }
        .day-rate {
            display: block;
            font-size: 0.8em;
            color: #666;
            margin-top: 2px;
        }
        
        .flatpickr-day {
            height: auto !important;
            min-height: 38px;
            padding: 5px;
        }

        .flatpickr-calendar {
            width: 600px !important;
        }

        .dayContainer {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
        }

        .flatpickr-days {
            width: 100% !important;
        }

        .flatpickr-day {
            width: 75px !important;
            max-width: 75px !important;
            height: 75px !important;
            line-height: 1 !important;
            margin: 2px;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            padding: 5px !important;
        }

        .day-rate {
            display: block;
            font-size: 0.9em;
            color: #666;
            margin-top: 4px;
        }

        .flatpickr-day > span:first-child {
            margin-bottom: 4px;
        }

        .flatpickr-day.past-date {
            background-color: #f5f5f5 !important;
            border-color: #e0e0e0 !important;
            color: #9e9e9e !important;
            cursor: not-allowed !important;
            pointer-events: none;
        }

        .flatpickr-day.past-date:hover {
            background-color: #f5f5f5 !important;
        }

        .flatpickr-day.past-date .day-rate {
            color: #9e9e9e !important;
        }
    `;

    document.head.insertAdjacentHTML('beforeend', `<style>${styles}</style>`);
});