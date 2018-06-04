from django.conf import settings
from django.core.management.base import BaseCommand

import pandas as pd

from categories.models import SetAside, Pool, Zone
from vendors.models import Vendor, PoolMembership

import os
import logging
import re
import math


def vendor_logger():
    return logging.getLogger('vendor')

    
def format_ascii(text):
    return re.sub(r'[^\x00-\x7F]+', '', str(text).strip())

def format_duns(text):
    return format_ascii(int(text)).replace('X', '0').replace('x', '0').zfill(9)

def format_duns_plus_4(text):
    return format_duns(text) + '0000'

def format_date(text):
    date = None
    
    if text and type(text) is str and not re.match(r'^(0|N[\.\/]?A\.?)$', text, re.IGNORECASE):
        text = format_ascii(text)
        regex = re.search(r'^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})\s*$', text, re.IGNORECASE)
        
        month = regex.group(1)
        day = regex.group(2)
        year = regex.group(3) 
        date = "{}-{}-{}".format(year, month.zfill(2), day.zfill(2))
    
    return date

def format_emails(text):
    emails = []
    
    if text and type(text) is str and not re.match(r'^(0|N[\.\/]?A\.?)$', text, re.IGNORECASE):
        for email in re.split(r'\s*[\,]\s*', text, re.IGNORECASE):
            emails.append(format_ascii(email))
    
    return emails

def format_phones(text):
    
    def format_phone(text):
        text = format_ascii(text)
        regex = re.search(r'^\s*\(?\s*(\d{3})\s*[\)\-\.]*\s*(\d{3})\s*[\-\.]*\s*(\d{4})\s*(?:(?:[xX\-]+|ext[\.\:]*)\s*(\d+)|\([^\)]+\))?\s*$', text, re.IGNORECASE)
        
        area_code = regex.group(1)
        first = regex.group(2)
        last = regex.group(3)
        extension = regex.group(4)
    
        phone = "{}-{}-{}".format(area_code, first, last)
        if extension:
            phone = "{} x {}".format(phone, extension)
        
        return phone
    
    phones = []
    
    if text and type(text) is str and not re.match(r'^\s*(0|N[\.\/]?A\.?)\s*$', text, re.IGNORECASE):
        for phone in re.split(r'\s*([\,]|or[A-Za-z\.\s]*\:?)\s*', text, re.IGNORECASE):
            try:
                phone = format_phone(phone)
                phones.append(phone)
            except Exception as e:
                pass
    
    return phones


def check_num(text):
    return text and not math.isnan(text)

def check_text(text):
    return text and len(str(text)) > 0

def check_bool(text):
    if text:
        return re.match(r'^X$', format_ascii(text), re.IGNORECASE)
    return False


def get_zones(record):
    zones = []
    
    for id in range(1, 7):
        try:
            if check_bool(record["Zone{}".format(id)]):
                zones.append(id)
                
        except Exception as e:
            pass
    
    return zones


def get_setasides(record):
    setasides = []
    
    try:
        if check_bool(record['8(a)']):
            setasides.append('8(A)')
    except Exception as e:
        pass
        
    try:
        if check_bool(record['HubZ']):
            setasides.append('HubZ')
    except Exception as e:
        pass
    
    try:
        if check_bool(record['SDB']):
            setasides.append('SDB')
    except Exception as e:
        pass
    
    try:
        if check_bool(record['WO']):
            setasides.append('WO')
    except Exception as e:
        pass
    
    try:
        if check_bool(record['VO']):
            setasides.append('VO')
    except Exception as e:
        pass
    
    try:
        if check_bool(record['SDVOSB']):
            setasides.append('SDVO')
    except Exception as e:
        pass
    
    try:
        if check_bool(record['VIP']):
            setasides.append('VIP')
    except Exception as e:
        pass
    
    return setasides


class Command(BaseCommand):
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--vehicles',
            action='store',
            type=str,
            default='',
            dest='vehicles',
            help='Comma separated list of vehicles to load (lowercase)',
        )
        parser.add_argument(
            '--pools',
            action='store',
            type=str,
            default='',
            dest='pools',
            help='Comma separated list of pool numbers to load from each vehicle',
        )
        parser.add_argument(
            '--vpp',
            action='store',
            type=int,
            default=0,
            dest='vpp',
            help='Number of vendors to load per pool (useful for creating fixtures)',
        )
        
    
    def update_vendor(self, columns, record, pool_data, options):
        logger = vendor_logger()
        
        if check_num(record['DUNS']) and check_text(record['ContractNumber']):
            #print(record)
            name = format_ascii(record['ContractorName'])
            piid = format_ascii(record['ContractNumber'])
            duns = format_duns(record['DUNS'])
        
            # Get vendor object
            vendor, created = Vendor.objects.get_or_create(duns=duns)
        
            print("[ {} ] - Updating vendor: {} from pool {}".format(vendor.id, name, pool_data.id))
        
            # Update basic vendor information
            vendor.name = name
            vendor.duns_4 = format_duns_plus_4(duns)
            vendor.save()
            
            # Update pool membership information
            membership, ppcreated = PoolMembership.objects.get_or_create(vendor=vendor, pool=pool_data, piid=piid)
            
            # Basic membership information
            if 'ContractEnd' in columns:
                membership.contract_end_date = format_date(record['ContractEnd'])
                
            if '8(a)Date' in columns:
                membership.expiration_8a_date = format_date(record['8(a)Date'])
                
            membership.save()
            
            # Add contract manager
            cm, cm_created = membership.cms.get_or_create(name=format_ascii(record['POC1']))
        
            for number in format_phones(record['Phone1']):
                cm.phones.get_or_create(number=number)
        
            for address in format_emails(record['Email1']):
                cm.emails.get_or_create(address=address)
                
            # Add project manager
            pm, pm_created = membership.pms.get_or_create(name=format_ascii(record['POC2']))
        
            for number in format_phones(record['Phone2']):
                pm.phones.get_or_create(number=number)
        
            for address in format_emails(record['Email2']):
                pm.emails.get_or_create(address=address)
            
            # Add zone information (if it exists)
            for zone_id in get_zones(record):
                try:
                    zone = Zone.objects.get(id=int(zone_id))
                    if zone not in membership.zones.all():
                        membership.zones.add(zone)

                except Zone.DoesNotExist as error:
                    continue
            
            # Add setaside information (if it exists)
            for name in get_setasides(record):
                try:
                    sa = SetAside.objects.get(name=name)
                    if sa not in membership.setasides.all():
                        membership.setasides.add(sa)

                except SetAside.DoesNotExist as error:
                    continue
            
            if created:
                logger.debug("Successfully created {}".format(vendor.name))
            else:
                logger.debug("Vendor {} already in database".format(vendor.name))

        
    def update_pool(self, vehicle, pool, df, options):
        logger = vendor_logger()
        vendors_per_pool = options['vpp']
        pool_count = 0
        columns = list(df.columns)
                
        print("Processing pool: {}".format(pool))
        
        try:
            pool_data = Pool.objects.get(number=pool, vehicle__iexact=vehicle)
            
            for index, record in df.iterrows():
                self.update_vendor(columns, record, pool_data, options)
                pool_count += 1
                
                if vendors_per_pool > 0 and pool_count == vendors_per_pool:
                    break

        except Pool.DoesNotExist as e:
            logger.debug("Pool {} not found for spreadsheet".format(pool))
            raise(e)

        except Pool.MultipleObjectsReturned as e:
            logger.debug("More than one pool matched {}. Integrity error!".format(pool))
            raise(e)
        
        print(" --- completed pool {} with: {} vendor(s) processed".format(pool, pool_count))


    def update_vehicle(self, vehicle, options, pools):
        vehicle_file = os.path.join(settings.BASE_DIR, 'data/pools/{}.xlsx'.format(vehicle))
        wb = pd.ExcelFile(vehicle_file)
        sheets = wb.sheet_names
        
        print("Processing vehicle: {}".format(vehicle))
        
        for name in sheets:
            try:
                pool = re.search(r'Pool\s+([0-9A-Z]+)', name, re.IGNORECASE).group(1)
                
                if len(pools) == 0 or pool in pools:
                    self.update_pool(vehicle, pool, wb.parse(name), options)

            except AttributeError as e:
                pass # Not a pool file, skip...
        

    def handle(self, *args, **options):
        vehicles = [x.strip() for x in options['vehicles'].lower().split(',') if x != '']
        pools = [x.strip() for x in options['pools'].lower().split(',') if x != '']
        
        for vehicle in settings.VEHICLES:
            if len(vehicles) == 0 or vehicle in vehicles:
                self.update_vehicle(vehicle, options, pools)
