# Generated by Django 2.0.2 on 2018-06-14 07:06

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('categories', '0011_auto_20180614_0454'),
    ]

    operations = [
        migrations.AlterField(
            model_name='keyword',
            name='name',
            field=models.CharField(max_length=500, null=True),
        ),
    ]
